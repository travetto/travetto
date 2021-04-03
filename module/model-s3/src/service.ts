import * as s3 from '@aws-sdk/client-s3';
import type { MetadataBearer } from '@aws-sdk/types';

import { StreamUtil } from '@travetto/boot';
import {
  ModelCrudSupport, ModelStreamSupport, ModelStorageSupport, StreamMeta,
  ModelType, ModelRegistry, ExistsError, NotFoundError, SubTypeNotSupportedError
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { Class, AppError, Util } from '@travetto/base';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';

import { S3ModelConfig } from './config';

function isMetadataBearer(o: unknown): o is MetadataBearer {
  return !!o && '$metadata' in (o as object);
}

function hasContenttype<T>(o: T): o is T & { contenttype?: string } {
  return o && 'contenttype' in o;
}

/**
 * Asset source backed by S3
 */
@Injectable()
export class S3ModelService implements ModelCrudSupport, ModelStreamSupport, ModelStorageSupport, ModelExpirySupport {

  client: s3.S3;

  constructor(public readonly config: S3ModelConfig) { }

  #resolveKey(cls: Class | string, id?: string) {
    let key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    if (id) {
      key = `${key}:${id}`;
    }
    if (this.config.namespace) {
      key = `${this.config.namespace}/${key}`;
    }
    return key;
  }

  #q<U extends object>(cls: string | Class, id: string, extra: U = {} as U) {
    const key = this.#resolveKey(cls, id);
    return { Key: key, Bucket: this.config.bucket, ...extra } as (U & { Key: string, Bucket: string });
  }

  #getExpiryConfig<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).expiresAt) {
      const { expiresAt } = ModelExpiryUtil.getExpiryState(cls, item as T);
      if (expiresAt) {
        return { Expires: expiresAt };
      }
    }
    return {};
  }

  async * #iterateBucket(cls?: string | Class) {
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
  async #writeMultipart(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void> {
    const { UploadId } = await this.client.createMultipartUpload(this.#q('_stream', id, {
      ContentType: meta.contentType,
      ContentLength: meta.size,
    }));

    const parts: s3.CompletedPart[] = [];
    let buffers: Buffer[] = [];
    let total = 0;
    let n = 1;
    const flush = async () => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.#q('_stream', id, {
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
      for await (const chunk of stream) {
        buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        total += chunk.length;
        if (total > this.config.chunkSize) {
          await flush();
        }
      }
      await flush();

      await this.client.completeMultipartUpload(this.#q('_stream', id, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (e) {
      await this.client.abortMultipartUpload(this.#q('_stream', id, { UploadId }));
      throw e;
    }
  }

  uuid() {
    return Util.uuid(32);
  }

  async postConstruct() {
    this.client = new s3.S3(this.config.config);
  }

  async head<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const res = await this.client.headObject(this.#q(cls, id));
      const { expiresAt } = ModelRegistry.get(cls);
      if (expiresAt && res.Expires && res.Expires.getTime() < Date.now()) {
        return false;
      }
      return true;
    } catch (e) {
      if (isMetadataBearer(e)) {
        if (e.$metadata.httpStatusCode === 404) {
          return false;
        }
      }
      throw e;
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const result = await this.client.getObject(this.#q(cls, id));
      if (result.Body) {
        const body = (await StreamUtil.streamToBuffer(result.Body)).toString('utf8');
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
    } catch (e) {
      if (isMetadataBearer(e)) {
        if (e.$metadata.httpStatusCode === 404) {
          e = new NotFoundError(cls, id);
        }
      }
      throw e;
    }
  }

  async store<T extends ModelType>(cls: Class<T>, item: T, preStore = true) {
    if (preStore) {
      item = await ModelCrudUtil.preStore(cls, item, this);
    }
    await this.client.putObject(this.#q(cls, item.id, {
      Body: JSON.stringify(item),
      ContentType: 'application/json',
      ...this.#getExpiryConfig(cls, item)
    }));
    return item;
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (item.id) {
      if (await this.head(cls, item.id)) {
        throw new ExistsError(cls, item.id);
      }
    }
    return this.store(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    if (!(await this.head(cls, item.id))) {
      throw new NotFoundError(cls, item.id);
    }
    return this.store(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    return this.store(cls, item);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    return this.store<T>(cls, item as T, false);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    if (!(await this.head(cls, id))) {
      throw new NotFoundError(cls, id);
    }
    await this.client.deleteObject(this.#q(cls, id));
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for await (const batch of this.#iterateBucket(cls)) {
      for (const { id } of batch) {
        try {
          yield await this.get(cls, id);
        } catch (e) {
          if (!(e instanceof NotFoundError)) {
            throw e;
          }
        }
      }
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return -1;
  }

  async upsertStream(location: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    if (meta.size < this.config.chunkSize) { // If bigger than 5 mb
      // Upload to s3
      await this.client.putObject(this.#q('_stream', location, {
        Body: await StreamUtil.toBuffer(stream),
        ContentType: meta.contentType,
        ContentLength: meta.size,
        Metadata: {
          ...meta,
          size: `${meta.size}`
        }
      }));
    } else {
      await this.#writeMultipart(location, stream, meta);
    }
  }

  async getStream(location: string) {
    // Read from s3
    const res = await this.client.getObject(this.#q('_stream', location));
    if (res.Body instanceof Buffer || // Buffer
      typeof res.Body === 'string' || // string
      res.Body && ('pipe' in res.Body) // Stream
    ) {
      return StreamUtil.toStream(res.Body);
    }
    throw new AppError(`Unable to read type: ${typeof res.Body}`);
  }

  async headStream(location: string) {
    const query = this.#q('_stream', location);
    try {
      return await this.client.headObject(query);
    } catch (e) {
      if (isMetadataBearer(e)) {
        if (e.$metadata.httpStatusCode === 404) {
          e = new NotFoundError('_stream', location);
        }
      }
      throw e;
    }
  }

  async describeStream(location: string) {
    const obj = await this.headStream(location);

    if (obj) {
      const ret = {
        ...obj.Metadata,
        size: obj.ContentLength!,
      } as StreamMeta;
      if (hasContenttype(ret)) {
        ret['contentType'] = ret['contenttype']!;
        delete ret['contenttype'];
      }
      return ret;
    } else {
      throw new NotFoundError('_stream', location);
    }
  }

  async deleteStream(location: string) {
    await this.client.deleteObject(this.#q('_stream', location));
  }

  async createStorage() {
    try {
      await this.client.headBucket({ Bucket: this.config.bucket });
    } catch (e) {
      await this.client.createBucket({ Bucket: this.config.bucket });
    }
  }

  async deleteStorage() {
    for await (const items of this.#iterateBucket('')) {
      await this.client.deleteObjects({
        Bucket: this.config.bucket,
        Delete: {
          Objects: items
        }
      });
    }
    // await this.client.deleteBucket({ Bucket: this.config.bucket });
  }
}
