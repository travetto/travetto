import { Agent } from 'node:https';

import { S3, type CompletedPart, type CreateMultipartUploadRequest, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { MetadataBearer } from '@aws-sdk/types';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  type ModelCrudSupport, type ModelStorageSupport, type ModelType, ModelRegistryIndex, ExistsError, NotFoundError, type OptionalId,
  type ModelBlobSupport, type ModelExpirySupport, ModelCrudUtil, ModelExpiryUtil, ModelStorageUtil
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import {
  type Class, RuntimeError, castTo, asFull, type BinaryMetadata, type ByteRange, type BinaryType,
  BinaryUtil, type TimeSpan, TimeUtil, type BinaryArray, CodecUtil, BinaryMetadataUtil, TypedObject, JSONUtil
} from '@travetto/runtime';

import type { S3ModelConfig } from './config.ts';

function isMetadataBearer(value: unknown): value is MetadataBearer {
  return !!value && typeof value === 'object' && '$metadata' in value;
}

function hasContentType<T>(value: T): value is T & { contenttype?: string } {
  return value !== undefined && value !== null && Object.hasOwn(value, 'contenttype');
}

type S3Metadata = Pick<CreateMultipartUploadRequest,
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

  #getMetadata(metadata: BinaryMetadata): S3Metadata {
    return {
      ContentType: metadata.contentType,
      ...(metadata.contentEncoding ? { ContentEncoding: metadata.contentEncoding } : {}),
      ...(metadata.contentLanguage ? { ContentLanguage: metadata.contentLanguage } : {}),
      ...(metadata.cacheControl ? { CacheControl: metadata.cacheControl } : {}),
      Metadata: TypedObject.fromEntries(
        TypedObject.entries(metadata)
          .map(([key, value]) => [key, typeof value === 'string' ? value : JSONUtil.toUTF8(value)] as const)
      )
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
    let key = typeof cls === 'string' ? cls : ModelRegistryIndex.getStoreName(cls);
    if (id) {
      key = `${key}:${id}`;
    }
    key = `_data/${key}`; // Separate data
    return this.#basicKey(key);
  }

  #query<U extends object>(cls: string | Class, id: string, extra: U = asFull({})): (U & { Key: string, Bucket: string }) {
    const key = this.#resolveKey(cls, id);
    return { Key: key, Bucket: this.config.bucket, ...extra };
  }

  #queryBlob<U extends object>(id: string, extra: U = asFull({})): (U & { Key: string, Bucket: string }) {
    const key = this.#basicKey(id);
    return { Key: key, Bucket: this.config.bucket, ...extra };
  }

  #getExpiryConfig<T extends ModelType>(cls: Class<T>, item: T): { Expires?: Date } {
    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
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
      const items = await this.client.listObjects({
        Bucket: this.config.bucket,
        Prefix: cls ? this.#resolveKey(cls) : this.config.namespace,
        Marker
      });
      if (items.Contents?.length) {
        yield items.Contents.map(item => ({ Key: item.Key!, id: item.Key!.split(':').pop()! }));
      }
      if (items.NextMarker) {
        Marker = items.NextMarker;
      } else {
        return;
      }
    }
  }

  /**
   * Write multipart file upload, in chunks
   */
  async #writeMultipart(id: string, input: BinaryType, metadata: BinaryMetadata): Promise<void> {
    const { UploadId } = await this.client.createMultipartUpload(this.#queryBlob(id, this.#getMetadata(metadata)));

    const parts: CompletedPart[] = [];
    let buffers: BinaryArray[] = [];
    let total = 0;
    let i = 1;
    const flush = async (): Promise<void> => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.#queryBlob(id, {
        Body: BinaryUtil.binaryArrayToUint8Array(BinaryUtil.combineBinaryArrays(buffers)),
        PartNumber: i,
        UploadId
      }));
      parts.push({ PartNumber: i, ETag: part.ETag });
      i += 1;
      buffers = [];
      total = 0;
    };
    try {
      for await (const chunk of BinaryUtil.toBinaryStream(input)) {
        const chunked = CodecUtil.readUtf8Chunk(chunk);
        buffers.push(chunked);
        total += chunked.byteLength;
        if (total > this.config.chunkSize) {
          await flush();
        }
      }
      await flush();

      await this.client.completeMultipartUpload(this.#queryBlob(id, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (error) {
      await this.client.abortMultipartUpload(this.#queryBlob(id, { UploadId }));
      throw error;
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
    } catch (error) {
      // Handle GCS
      if (error instanceof Error && error.name === 'NotImplemented') {
        for (const item of items) {
          await this.client.deleteObject({
            Bucket: this.config.bucket,
            Key: item.Key
          });
        }
      } else {
        throw error;
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
    ModelStorageUtil.storageInitialization(this);
  }

  async head<T extends ModelType>(cls: Class<T>, id: string): Promise<boolean> {
    try {
      const result = await this.client.headObject(this.#query(cls, id));
      const { expiresAt } = ModelRegistryIndex.getConfig(cls);
      if (expiresAt && result.ExpiresString && Date.parse(result.ExpiresString) < Date.now()) {
        return false;
      }
      return true;
    } catch (error) {
      if (isMetadataBearer(error)) {
        if (error.$metadata.httpStatusCode === 404) {
          return false;
        }
      }
      throw error;
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    try {
      const result = await this.client.getObject(this.#query(cls, id));
      if (result.Body) {
        const body = await BinaryUtil.toBinaryArray(result.Body);
        const output = await ModelCrudUtil.load(cls, body);
        if (output) {
          const { expiresAt } = ModelRegistryIndex.getConfig(cls);
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
    } catch (error) {
      if (isMetadataBearer(error)) {
        if (error.$metadata.httpStatusCode === 404) {
          error = new NotFoundError(cls, id);
        }
      }
      throw error;
    }
  }

  async store<T extends ModelType>(cls: Class<T>, item: OptionalId<T>, preStore = true): Promise<T> {
    let prepped: T = castTo(item);
    if (preStore) {
      prepped = await ModelCrudUtil.preStore(cls, item, this);
    }
    const content = JSONUtil.toBinaryArray(prepped);
    await this.client.putObject(this.#query(cls, prepped.id, {
      Body: BinaryUtil.binaryArrayToUint8Array(content),
      ContentType: 'application/json',
      ContentLength: content.byteLength,
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
    await this.client.deleteObject(this.#query(cls, id));
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const batch of this.#iterateBucket(cls)) {
      for (const { id } of batch) {
        try {
          yield await this.get(cls, id);
        } catch (error) {
          if (!(error instanceof NotFoundError)) {
            throw error;
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
  async upsertBlob(location: string, input: BinaryType, metadata?: BinaryMetadata, overwrite = true): Promise<void> {
    if (!overwrite && await this.getBlobMetadata(location).then(() => true, () => false)) {
      return;
    }

    const resolved = await BinaryMetadataUtil.compute(input, metadata);

    const length = BinaryMetadataUtil.readLength(resolved);

    if (length && length < this.config.chunkSize) { // If smaller than chunk size
      const blob = this.#queryBlob(location, {
        Body: BinaryUtil.toReadable(input),
        ContentLength: length,
        ...this.#getMetadata(resolved),
      });
      // Upload to s3
      await this.client.putObject(blob);
    } else {
      await this.#writeMultipart(location, input, resolved);
    }
  }

  async #getObject(location: string, range?: Required<ByteRange>): Promise<BinaryType> {
    // Read from s3
    const result = await this.client.getObject(this.#queryBlob(location, range ? {
      Range: `bytes=${range.start}-${range.end}`
    } : {}));

    const body: BinaryType | string | undefined = castTo(result.Body);

    switch (typeof body) {
      case 'undefined': throw new RuntimeError('Unable to read type: undefined');
      case 'string': return body.endsWith('=') ?
        CodecUtil.fromBase64String(body) :
        CodecUtil.fromUTF8String(body);
      default: return body;
    }
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const metadata = await this.getBlobMetadata(location);
    const final = range ? BinaryMetadataUtil.enforceRange(range, metadata) : undefined;
    return BinaryMetadataUtil.makeBlob(() => this.#getObject(location, final), { ...metadata, range: final });
  }

  async headBlob(location: string): Promise<{ Metadata?: BinaryMetadata, ContentLength?: number }> {
    const query = this.#queryBlob(location);
    try {
      return (await this.client.headObject(query));
    } catch (error) {
      if (isMetadataBearer(error)) {
        if (error.$metadata.httpStatusCode === 404) {
          error = new NotFoundError('Blob', location);
        }
      }
      throw error;
    }
  }

  async getBlobMetadata(location: string): Promise<BinaryMetadata> {
    const blob = await this.headBlob(location);

    if (blob) {
      const metadata: BinaryMetadata = {
        contentType: '',
        ...blob.Metadata,
        size: blob.ContentLength!,
      };
      if (hasContentType(metadata)) {
        metadata['contentType'] = metadata['contenttype']!;
        delete metadata['contenttype'];
      }
      return metadata;
    } else {
      throw new NotFoundError('Blob', location);
    }
  }

  async deleteBlob(location: string): Promise<void> {
    await this.client.deleteObject(this.#queryBlob(location));
  }

  async updateBlobMetadata(location: string, metadata: BinaryMetadata): Promise<void> {
    await this.client.copyObject({
      Bucket: this.config.bucket,
      Key: this.#basicKey(location),
      CopySource: `/${this.config.bucket}/${this.#basicKey(location)}`,
      ...this.#getMetadata(metadata),
      MetadataDirective: 'REPLACE'
    });
  }

  // Signed urls
  async getBlobReadUrl(location: string, expiresIn: TimeSpan = '1h'): Promise<string> {
    return await getSignedUrl(
      this.client,
      new GetObjectCommand(this.#queryBlob(location)),
      { expiresIn: TimeUtil.duration(expiresIn, 's') }
    );
  }

  async getBlobWriteUrl(location: string, metadata: BinaryMetadata, expiresIn: TimeSpan = '1h'): Promise<string> {
    const base = this.#getMetadata(metadata);
    return await getSignedUrl(
      this.client,
      new PutObjectCommand({
        ...this.#queryBlob(location),
        ...base,
        ...(metadata.size ? { ContentLength: metadata.size } : {}),
        ...((metadata.hash && metadata.hash !== '-1') ? { ChecksumSHA256: metadata.hash } : {}),
      }),
      {
        expiresIn: TimeUtil.duration(expiresIn, 's'),
        ...(metadata.contentType ? { signableHeaders: new Set(['content-type']) } : {})
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