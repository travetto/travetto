import { Readable } from 'stream';

import * as s3 from '@aws-sdk/client-s3';
import type { MetadataBearer } from '@aws-sdk/types';

import { StreamUtil } from '@travetto/boot';
import {
  ModelCrudSupport, ModelStreamSupport, ModelStorageSupport, StreamMeta,
  ModelType, ModelRegistry, ExistsError, NotFoundError, OptionalId
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { Class, AppError } from '@travetto/base';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelUtil } from '@travetto/model/src/internal/util';

import { S3ModelConfig } from './config';

function isMetadataBearer(o: unknown): o is MetadataBearer {
  return !!o && typeof o === 'object' && '$metadata' in o;
}

function hasContentType<T>(o: T): o is T & { contenttype?: string } {
  return o && 'contenttype' in o;
}

const STREAM_SPACE = '@trv:stream';

/**
 * Asset source backed by S3
 */
@Injectable()
export class S3ModelService implements ModelCrudSupport, ModelStreamSupport, ModelStorageSupport, ModelExpirySupport {

  client: s3.S3;

  constructor(public readonly config: S3ModelConfig) { }

  #resolveKey(cls: Class | string, id?: string): string {
    let key: string;
    if (cls === STREAM_SPACE) { // If we are streaming, treat as primary use case
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

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  #q<U extends object>(cls: string | Class, id: string, extra: U = {} as U): (U & { Key: string, Bucket: string }) {
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
  async #writeMultipart(id: string, input: Readable, meta: StreamMeta): Promise<void> {
    const { UploadId } = await this.client.createMultipartUpload(this.#q(STREAM_SPACE, id, {
      ContentType: meta.contentType,
      ContentLength: meta.size,
    }));

    const parts: s3.CompletedPart[] = [];
    let buffers: Buffer[] = [];
    let total = 0;
    let n = 1;
    const flush = async (): Promise<void> => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.#q(STREAM_SPACE, id, {
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

      await this.client.completeMultipartUpload(this.#q(STREAM_SPACE, id, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (err) {
      await this.client.abortMultipartUpload(this.#q(STREAM_SPACE, id, { UploadId }));
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

  uuid(): string {
    return ModelUtil.uuid(32);
  }

  async postConstruct(): Promise<void> {
    this.client = new s3.S3(this.config.config);
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
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const body = (await StreamUtil.streamToBuffer(result.Body as Readable)).toString('utf8');
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    let prepped: T = item as T;
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

  async upsertStream(location: string, input: Readable, meta: StreamMeta): Promise<void> {
    if (meta.size < this.config.chunkSize) { // If bigger than 5 mb
      // Upload to s3
      await this.client.putObject(this.#q(STREAM_SPACE, location, {
        Body: await StreamUtil.toBuffer(input),
        ContentType: meta.contentType,
        ContentLength: meta.size,
        Metadata: {
          ...meta,
          size: `${meta.size}`
        }
      }));
    } else {
      await this.#writeMultipart(location, input, meta);
    }
  }

  async getStream(location: string): Promise<Readable> {
    // Read from s3
    const res = await this.client.getObject(this.#q(STREAM_SPACE, location));
    if (res.Body instanceof Buffer || // Buffer
      typeof res.Body === 'string' || // string
      res.Body && ('pipe' in res.Body) // Stream
    ) {
      return StreamUtil.toStream(res.Body);
    }
    throw new AppError(`Unable to read type: ${typeof res.Body}`);
  }

  async headStream(location: string): Promise<{ Metadata?: Partial<StreamMeta>, ContentLength?: number }> {
    const query = this.#q(STREAM_SPACE, location);
    try {
      return (await this.client.headObject(query));
    } catch (err) {
      if (isMetadataBearer(err)) {
        if (err.$metadata.httpStatusCode === 404) {
          err = new NotFoundError(STREAM_SPACE, location);
        }
      }
      throw err;
    }
  }

  async describeStream(location: string): Promise<StreamMeta> {
    const obj = await this.headStream(location);

    if (obj) {
      const ret: StreamMeta = {
        // @ts-expect-error
        contentType: '',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ...obj.Metadata as StreamMeta,
        size: obj.ContentLength!,
      };
      if (hasContentType(ret)) {
        ret['contentType'] = ret['contenttype']!;
        delete ret['contenttype'];
      }
      return ret;
    } else {
      throw new NotFoundError(STREAM_SPACE, location);
    }
  }

  async truncateModel<T extends ModelType>(model: Class<T>): Promise<void> {
    for await (const items of this.#iterateBucket(model)) {
      await this.#deleteKeys(items);
    }
  }

  async deleteStream(location: string): Promise<void> {
    await this.client.deleteObject(this.#q(STREAM_SPACE, location));
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