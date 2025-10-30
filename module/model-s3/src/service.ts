import { Readable } from 'node:stream';
import { text as toText, buffer as toBuffer } from 'node:stream/consumers';
import { Agent } from 'node:https';

import { S3, CompletedPart, type CreateMultipartUploadRequest, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { MetadataBearer } from '@aws-sdk/types';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  ModelCrudSupport, ModelStorageSupport, ModelType, ModelRegistryIndex, ExistsError, NotFoundError, OptionalId,
  ModelBlobSupport, ModelExpirySupport, ModelBlobUtil, ModelCrudUtil, ModelExpiryUtil, ModelStorageUtil,
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { Class, AppError, castTo, asFull, BlobMeta, ByteRange, BinaryInput, BinaryUtil, TimeSpan, TimeUtil } from '@travetto/runtime';

import { S3ModelConfig } from './config.ts';

function isMetadataBearer(o: unknown): o is MetadataBearer {
  return !!o && typeof o === 'object' && '$metadata' in o;
}

function hasContentType<T>(o: T): o is T & { contenttype?: string } {
  return o !== undefined && o !== null && Object.hasOwn(o, 'contenttype');
}

type MetaBase = Pick<CreateMultipartUploadRequest,
  'ContentType' | 'Metadata' | 'ContentEncoding' | 'ContentLanguage' | 'CacheControl' | 'ContentDisposition'
>;

/**
 * Asset source backed by S3
 */
@Injectable()
export class S3ModelService implements ModelCrudSupport, ModelBlobSupport, ModelStorageSupport, ModelExpirySupport {

  idSource = ModelCrudUtil.uuidSource();
  client: S3;
  config: S3ModelConfig;

  constructor(config: S3ModelConfig) { this.config = config; }

  #getMetaBase({ range: _, size, ...meta }: BlobMeta): MetaBase {
    return {
      ContentType: meta.contentType,
      ...(meta.contentEncoding ? { ContentEncoding: meta.contentEncoding } : {}),
      ...(meta.contentLanguage ? { ContentLanguage: meta.contentLanguage } : {}),
      ...(meta.cacheControl ? { CacheControl: meta.cacheControl } : {}),
      Metadata: {
        ...meta,
        ...(size ? { size: `${size}` } : {})
      }
    };
  }

  #basicKey(key: string): string {
    if (key?.startsWith('/')) {
      key = key.substring(1);
    }
    if (this.config.namespace) {
      key = `${this.config.namespace}/${key}`;
    }
    return key;
  }

  #resolveKey(cls: Class | string, id?: string): string {
    let key = typeof cls === 'string' ? cls : ModelRegistryIndex.getStore(cls);
    if (id) {
      key = `${key}:${id}`;
    }
    key = `_data/${key}`; // Separate data
    return this.#basicKey(key);
  }

  #q<U extends object>(cls: string | Class, id: string, extra: U = asFull({})): (U & { Key: string, Bucket: string }) {
    const key = this.#resolveKey(cls, id);
    return { Key: key, Bucket: this.config.bucket, ...extra };
  }

  #qBlob<U extends object>(id: string, extra: U = asFull({})): (U & { Key: string, Bucket: string }) {
    const key = this.#basicKey(id);
    return { Key: key, Bucket: this.config.bucket, ...extra };
  }


  #getExpiryConfig<T extends ModelType>(cls: Class<T>, item: T): { Expires?: Date } {
    if (ModelRegistryIndex.getClassConfig(cls).expiresAt) {
      const { expiresAt } = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiresAt) {
        return { Expires: expiresAt };
      }
    }
    return {};
  }

  async * #iterateBucket(cls?: string | Class): AsyncIterable<{ Key: string, id: string }[]> {
    let Marker: string | undefined;
    for (; ;) {
      const obs = await this.client.listObjects({
        Bucket: this.config.bucket,
        Prefix: cls ? this.#resolveKey(cls) : this.config.namespace,
        Marker
      });
      if (obs.Contents?.length) {
        yield obs.Contents.map(o => ({ Key: o.Key!, id: o.Key!.split(':').pop()! }));
      }
      if (obs.NextMarker) {
        Marker = obs.NextMarker;
      } else {
        return;
      }
    }
  }

  /**
   * Write multipart file upload, in chunks
   */
  async #writeMultipart(id: string, input: Readable, meta: BlobMeta): Promise<void> {
    const { UploadId } = await this.client.createMultipartUpload(this.#qBlob(id, this.#getMetaBase(meta)));

    const parts: CompletedPart[] = [];
    let buffers: Buffer[] = [];
    let total = 0;
    let n = 1;
    const flush = async (): Promise<void> => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.#qBlob(id, {
        Body: Buffer.concat(buffers),
        PartNumber: n,
        UploadId
      }));
      parts.push({ PartNumber: n, ETag: part.ETag });
      n += 1;
      buffers = [];
      total = 0;
    };
    try {
      for await (const chunk of input) {
        const chunked = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        buffers.push(chunked);
        total += chunked.length;
        if (total > this.config.chunkSize) {
          await flush();
        }
      }
      await flush();

      await this.client.completeMultipartUpload(this.#qBlob(id, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (err) {
      await this.client.abortMultipartUpload(this.#qBlob(id, { UploadId }));
      throw err;
    }
  }

  async #deleteKeys(items: { Key: string }[]): Promise<void> {
    try {
      await this.client.deleteObjects({
        Bucket: this.config.bucket,
        Delete: {
          Objects: items
        }
      });
    } catch (err) {
      // Handle GCS
      if (err instanceof Error && err.name === 'NotImplemented') {
        for (const item of items) {
          await this.client.deleteObject({
            Bucket: this.config.bucket,
            Key: item.Key
          });
        }
      } else {
        throw err;
      }
    }
  }

  async postConstruct(): Promise<void> {
    this.client = new S3({
      ...this.config.config,
      ...('requestHandler' in this.config.config ? {
        requestHandler: new NodeHttpHandler({
          ...this.config.config.requestHandler,
          ...('httpsAgent' in this.config.config.requestHandler! ? {
            httpsAgent: new Agent({ ...this.config.config.requestHandler?.httpsAgent ?? {} }),
          } : {})
        }),
      } : {})
    });
    ModelStorageUtil.registerModelChangeListener(this);
  }

  async head<T extends ModelType>(cls: Class<T>, id: string): Promise<boolean> {
    try {
      const result = await this.client.headObject(this.#q(cls, id));
      const { expiresAt } = ModelRegistryIndex.getClassConfig(cls);
      if (expiresAt && result.ExpiresString && Date.parse(result.ExpiresString) < Date.now()) {
        return false;
      }
      return true;
    } catch (err) {
      if (isMetadataBearer(err)) {
        if (err.$metadata.httpStatusCode === 404) {
          return false;
        }
      }
      throw err;
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    try {
      const result = await this.client.getObject(this.#q(cls, id));
      if (result.Body) {
        const body = await toText(castTo(result.Body));
        const output = await ModelCrudUtil.load(cls, body);
        if (output) {
          const { expiresAt } = ModelRegistryIndex.getClassConfig(cls);
          if (expiresAt) {
            const expiry = ModelExpiryUtil.getExpiryState(cls, output);
            if (!expiry.expired) {
              return output;
            }
          } else {
            return output;
          }
        }
      }
      throw new NotFoundError(cls, id);
    } catch (err) {
      if (isMetadataBearer(err)) {
        if (err.$metadata.httpStatusCode === 404) {
          err = new NotFoundError(cls, id);
        }
      }
      throw err;
    }
  }

  async store<T extends ModelType>(cls: Class<T>, item: OptionalId<T>, preStore = true): Promise<T> {
    let prepped: T = castTo(item);
    if (preStore) {
      prepped = await ModelCrudUtil.preStore(cls, item, this);
    }
    const content = Buffer.from(JSON.stringify(prepped), 'utf8');
    await this.client.putObject(this.#q(cls, prepped.id, {
      Body: content,
      ContentType: 'application/json',
      ContentLength: content.length,
      ...this.#getExpiryConfig(cls, prepped)
    }));
    return prepped;
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    if (item.id) {
      if (await this.head(cls, item.id)) {
        throw new ExistsError(cls, item.id);
      }
    }
    return this.store(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    if (!(await this.head(cls, item.id))) {
      throw new NotFoundError(cls, item.id);
    }
    return this.store(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    return this.store(cls, item);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    const prepped = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    return this.store<T>(cls, prepped, false);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);
    if (!(await this.head(cls, id))) {
      throw new NotFoundError(cls, id);
    }
    await this.client.deleteObject(this.#q(cls, id));
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const batch of this.#iterateBucket(cls)) {
      for (const { id } of batch) {
        try {
          yield await this.get(cls, id);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
      }
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(_cls: Class<T>): Promise<number> {
    return -1;
  }

  // Blob support
  async upsertBlob(location: string, input: BinaryInput, meta?: BlobMeta, overwrite = true): Promise<void> {
    if (!overwrite && await this.getBlobMeta(location).then(() => true, () => false)) {
      return;
    }

    const [stream, blobMeta] = await ModelBlobUtil.getInput(input, meta);

    if (blobMeta.size && blobMeta.size < this.config.chunkSize) { // If smaller than chunk size
      // Upload to s3
      await this.client.putObject(this.#qBlob(location, {
        Body: await toBuffer(stream),
        ContentLength: blobMeta.size,
        ...this.#getMetaBase(blobMeta),
      }));
    } else {
      await this.#writeMultipart(location, stream, blobMeta);
    }
  }

  async #getObject(location: string, range?: Required<ByteRange>): Promise<Readable> {
    // Read from s3
    const result = await this.client.getObject(this.#qBlob(location, range ? {
      Range: `bytes=${range.start}-${range.end}`
    } : {}));

    if (!result.Body) {
      throw new AppError('Unable to read type: undefined');
    }

    if (typeof result.Body === 'string') { // string
      return Readable.from(result.Body, { encoding: castTo<string>(result.Body).endsWith('=') ? 'base64' : 'utf8' });
    } else if (result.Body instanceof Buffer) { // Buffer
      return Readable.from(result.Body);
    } else if ('pipe' in result.Body) { // Stream
      return castTo<Readable>(result.Body);
    }
    throw new AppError(`Unable to read type: ${typeof result.Body}`);
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const meta = await this.getBlobMeta(location);
    const final = range ? ModelBlobUtil.enforceRange(range, meta.size!) : undefined;
    const result = (): Promise<Readable> => this.#getObject(location, final);
    return BinaryUtil.readableBlob(result, { ...meta, range: final });
  }

  async headBlob(location: string): Promise<{ Metadata?: BlobMeta, ContentLength?: number }> {
    const query = this.#qBlob(location);
    try {
      return (await this.client.headObject(query));
    } catch (err) {
      if (isMetadataBearer(err)) {
        if (err.$metadata.httpStatusCode === 404) {
          err = new NotFoundError('Blob', location);
        }
      }
      throw err;
    }
  }

  async getBlobMeta(location: string): Promise<BlobMeta> {
    const obj = await this.headBlob(location);

    if (obj) {
      const ret: BlobMeta = {
        contentType: '',
        ...obj.Metadata,
        size: obj.ContentLength!,
      };
      if (hasContentType(ret)) {
        ret['contentType'] = ret['contenttype']!;
        delete ret['contenttype'];
      }
      return ret;
    } else {
      throw new NotFoundError('Blob', location);
    }
  }

  async deleteBlob(location: string): Promise<void> {
    await this.client.deleteObject(this.#qBlob(location));
  }

  async updateBlobMeta(location: string, meta: BlobMeta): Promise<void> {
    await this.client.copyObject({
      Bucket: this.config.bucket,
      Key: this.#basicKey(location),
      CopySource: `/${this.config.bucket}/${this.#basicKey(location)}`,
      ...this.#getMetaBase(meta),
      MetadataDirective: 'REPLACE'
    });
  }

  // Signed urls
  async getBlobReadUrl(location: string, exp: TimeSpan = '1h'): Promise<string> {
    return await getSignedUrl(
      this.client,
      new GetObjectCommand(this.#qBlob(location)),
      { expiresIn: TimeUtil.asSeconds(exp) }
    );
  }

  async getBlobWriteUrl(location: string, meta: BlobMeta, exp: TimeSpan = '1h'): Promise<string> {
    const base = this.#getMetaBase(meta);
    return await getSignedUrl(
      this.client,
      new PutObjectCommand({
        ...this.#qBlob(location),
        ...base,
        ...(meta.size ? { ContentLength: meta.size } : {}),
        ...((meta.hash && meta.hash !== '-1') ? { ChecksumSHA256: meta.hash } : {}),
      }),
      {
        expiresIn: TimeUtil.asSeconds(exp),
        ...(meta.contentType ? { signableHeaders: new Set(['content-type']) } : {})
      }
    );
  }

  // Storage
  async truncateModel<T extends ModelType>(model: Class<T>): Promise<void> {
    for await (const items of this.#iterateBucket(model)) {
      await this.#deleteKeys(items);
    }
  }

  async createStorage(): Promise<void> {
    try {
      await this.client.headBucket({ Bucket: this.config.bucket });
    } catch {
      await this.client.createBucket({ Bucket: this.config.bucket });
    }
  }

  async deleteStorage(): Promise<void> {
    if (this.config.namespace) {
      for await (const items of this.#iterateBucket()) {
        await this.#deleteKeys(items);
      }
    } else {
      await this.client.deleteBucket({ Bucket: this.config.bucket });
    }
  }
}