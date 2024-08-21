import { Readable } from 'node:stream';
import { text as toText } from 'node:stream/consumers';
import { Agent } from 'node:https';

import { S3, CompletedPart, type CreateMultipartUploadRequest } from '@aws-sdk/client-s3';
import type { MetadataBearer } from '@aws-sdk/types';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import {
  ModelCrudSupport, ModelStorageSupport, ModelType, ModelRegistry, ExistsError, NotFoundError, OptionalId,
  ModelBlobSupport, ModelBlobUtil, BlobInputLocation,
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { Class, AppError, castTo, asFull } from '@travetto/runtime';
import { BinaryInput, BlobMeta, BlobUtil, ByteRange } from '@travetto/io';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { S3ModelConfig } from './config';

function isMetadataBearer(o: unknown): o is MetadataBearer {
  return !!o && typeof o === 'object' && '$metadata' in o;
}

function hasContentType<T>(o: T): o is T & { contenttype?: string } {
  return o !== undefined && o !== null && Object.hasOwn(o, 'contenttype');
}

const BLOB_SPACE = '@travetto/model-s3:blob';

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

  constructor(public readonly config: S3ModelConfig) { }

  #getMetaBase({ range, ...meta }: BlobMeta): MetaBase {
    return {
      ContentType: meta.contentType,
      ...(meta.contentEncoding ? { ContentEncoding: meta.contentEncoding } : {}),
      ...(meta.contentLanguage ? { ContentLanguage: meta.contentLanguage } : {}),
      ...(meta.cacheControl ? { CacheControl: meta.cacheControl } : {}),
      Metadata: {
        ...meta,
        size: `${meta.size}`
      }
    };
  }

  #resolveKey(cls: Class | string, id?: string): string {
    let key: string;
    if (cls === BLOB_SPACE) { // If we are streaming, treat as primary use case
      key = id!; // Store it directly at root
    } else {
      key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
      if (id) {
        key = `${key}:${id}`;
      }
      key = `_data/${key}`; // Separate data
    }
    if (this.config.namespace) {
      key = `${this.config.namespace}/${key}`;
    }
    return key;
  }

  #q<U extends object>(cls: string | Class, id: string, extra: U = asFull({})): (U & { Key: string, Bucket: string }) {
    const key = this.#resolveKey(cls, id);
    return { Key: key, Bucket: this.config.bucket, ...extra };
  }

  #getExpiryConfig<T extends ModelType>(cls: Class<T>, item: T): { Expires?: Date } {
    if (ModelRegistry.get(cls).expiresAt) {
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
      const obs = await this.client.listObjects({ Bucket: this.config.bucket, Prefix: cls ? this.#resolveKey(cls) : undefined, Marker });
      if (obs.Contents && obs.Contents.length) {
        yield (obs.Contents ?? []).map(o => ({ Key: o.Key!, id: o.Key!.split(':').pop()! }));
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
    const { UploadId } = await this.client.createMultipartUpload(this.#q(BLOB_SPACE, id, this.#getMetaBase(meta)));

    const parts: CompletedPart[] = [];
    let buffers: Buffer[] = [];
    let total = 0;
    let n = 1;
    const flush = async (): Promise<void> => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.#q(BLOB_SPACE, id, {
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
        buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        total += chunk.length;
        if (total > this.config.chunkSize) {
          await flush();
        }
      }
      await flush();

      await this.client.completeMultipartUpload(this.#q(BLOB_SPACE, id, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (err) {
      await this.client.abortMultipartUpload(this.#q(BLOB_SPACE, id, { UploadId }));
      throw err;
    }
  }

  async #deleteKeys(items: { Key: string }[]): Promise<void> {
    if (this.config.endpoint.includes('localhost')) {
      await Promise.all(items.map(item => this.client.deleteObject({
        Bucket: this.config.bucket,
        Key: item.Key
      })));
    } else {
      await this.client.deleteObjects({
        Bucket: this.config.bucket,
        Delete: {
          Objects: items
        }
      });
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
      const res = await this.client.headObject(this.#q(cls, id));
      const { expiresAt } = ModelRegistry.get(cls);
      if (expiresAt && res.Expires && res.Expires.getTime() < Date.now()) {
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
          const { expiresAt } = ModelRegistry.get(cls);
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
    await this.client.putObject(this.#q(cls, prepped.id, {
      Body: JSON.stringify(prepped),
      ContentType: 'application/json',
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
    const prepped = await ModelCrudUtil.naivePartialUpdate(cls, item, view, (): Promise<T> => this.get(cls, id));
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
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return -1;
  }

  // Blob support
  async insertBlob(location: BlobInputLocation, input: BinaryInput, meta?: Partial<BlobMeta>, errorIfExisting = false): Promise<void> {
    const loc = ModelBlobUtil.getLocation(location);
    await this.describeBlob(loc);
    if (errorIfExisting) {
      throw new ExistsError('Blob', loc);
    }
    return this.upsertBlob(loc, input, meta);
  }

  async upsertBlob(location: BlobInputLocation, input: BinaryInput, meta?: Partial<BlobMeta>): Promise<void> {
    const loc = ModelBlobUtil.getLocation(location);
    const resolved = await BlobUtil.memoryBlob(input, meta);
    meta = BlobUtil.getBlobMeta(resolved)!;

    if (resolved.size < this.config.chunkSize) { // If smaller than chunk size
      // Upload to s3
      await this.client.putObject(this.#q(BLOB_SPACE, loc, {
        Body: await resolved.bytes(),
        ContentLength: resolved.size,
        ...this.#getMetaBase(meta),
      }));
    } else {
      await this.#writeMultipart(loc, Readable.fromWeb(resolved.stream()), meta);
    }
  }

  async #getObject(location: string, range?: Required<ByteRange>): Promise<Readable> {
    // Read from s3
    const res = await this.client.getObject(this.#q(BLOB_SPACE, location, range ? {
      Range: `bytes=${range.start}-${range.end}`
    } : {}));

    if (!res.Body) {
      throw new AppError('Unable to read type: undefined');
    }

    if (typeof res.Body === 'string') { // string
      return Readable.from(res.Body, { encoding: castTo<string>(res.Body).endsWith('=') ? 'base64' : 'utf8' });
    } else if (res.Body instanceof Buffer) { // Buffer
      return Readable.from(res.Body);
    } else if ('pipe' in res.Body) { // Stream
      return castTo<Readable>(res.Body);
    }
    throw new AppError(`Unable to read type: ${typeof res.Body}`);
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const meta = await this.describeBlob(location);
    const final = range ? BlobUtil.enforceRange(range, meta.size!) : undefined;
    const res = (): Promise<Readable> => this.#getObject(location, final);
    return BlobUtil.lazyStreamBlob(res, { ...meta, range: final });
  }

  async headBlob(location: string): Promise<{ Metadata?: Partial<BlobMeta>, ContentLength?: number }> {
    const query = this.#q(BLOB_SPACE, location);
    try {
      return (await this.client.headObject(query));
    } catch (err) {
      if (isMetadataBearer(err)) {
        if (err.$metadata.httpStatusCode === 404) {
          err = new NotFoundError(BLOB_SPACE, location);
        }
      }
      throw err;
    }
  }

  async describeBlob(location: string): Promise<BlobMeta> {
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
      throw new NotFoundError(BLOB_SPACE, location);
    }
  }

  async deleteBlob(location: string): Promise<void> {
    await this.client.deleteObject(this.#q(BLOB_SPACE, location));
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
      for await (const items of this.#iterateBucket('')) {
        await this.#deleteKeys(items);
      }
    } else {
      await this.client.deleteBucket({ Bucket: this.config.bucket });
    }
  }
}