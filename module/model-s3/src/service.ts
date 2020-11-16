import * as s3 from '@aws-sdk/client-s3';

import { StreamUtil } from '@travetto/boot';
import { ModelCrudSupport, ModelStreamSupport, ModelStorageSupport, StreamMeta, ModelType, ModelRegistry } from '@travetto/model-core';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { Injectable } from '@travetto/di';
import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';

import { NotFoundError } from '@travetto/model-core/src/error/not-found';
import { ExistsError } from '@travetto/model-core/src/error/exists';

import { S3ModelConfig } from './config';

function toTagSet(metadata: StreamMeta) {
  return (['hash', 'contentType', 'size'] as const)
    .filter(x => x in metadata)
    .map(x => ({
      Key: x,
      Value: Buffer.from(JSON.stringify(metadata[x])).toString('base64')
    }));
}

function fromTagSet(tags: s3.Tag[]) {
  const all = ['hash', 'contentType', 'size'];
  const map = tags
    .filter(x => all.includes(x.Key!))
    .reduce((acc, x) => {
      (acc as any)[x.Key!] = JSON.parse(Buffer.from(x.Value!, 'base64').toString());
      return acc;
    }, {} as StreamMeta);
  return map;
}

/**
 * Asset source backed by S3
 */
@Injectable()
export class S3ModelService implements ModelCrudSupport, ModelStreamSupport, ModelStorageSupport {

  private client: s3.S3;

  constructor(private config: S3ModelConfig) {
  }

  private resolveKey(cls: Class | string, id?: string) {
    let key = typeof cls === 'string' ? cls : ModelRegistry.getBaseStore(cls);
    if (id) {
      key = `${key}:${id}`;
    }
    if (this.config.namespace) {
      key = `${this.config.namespace}/${key}`;
    }
    return key;
  }

  private q<U extends object>(cls: string | Class, id: string, extra: U = {} as U) {
    const key = this.resolveKey(cls, id);
    return { Key: key, Bucket: this.config.bucket, ...extra } as (U & { Key: string, Bucket: string });
  }

  private async * iterateBucket(cls?: string | Class) {
    let Marker: string | undefined;
    for (; ;) {
      const obs = await this.client.listObjects({ Bucket: this.config.bucket, Prefix: cls ? this.resolveKey(cls) : undefined, Marker });
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
  private async writeMultipart(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void> {
    const { UploadId } = await this.client.createMultipartUpload(this.q('_stream', id, {
      ContentType: meta.contentType,
      ContentLength: meta.size,
    }));

    const parts: s3.CompletedPart[] = [];
    let buffers: Buffer[] = [];
    let total = 0;
    let n = 1;
    const flush = async () => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.q('_stream', id, {
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

      await this.client.completeMultipartUpload(this.q('_stream', id, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (e) {
      await this.client.abortMultipartUpload(this.q('_stream', id, { UploadId }));
      throw e;
    }
  }

  uuid() {
    return Util.uuid(32);
  }

  async postConstruct() {
    this.client = new s3.S3(this.config.config);
  }

  async has<T extends ModelType>(cls: Class<T>, id: string, error?: 'notfound' | 'data') {
    try {
      await this.client.headObject(this.q(cls, id));
    } catch (err) {
      if (error === 'notfound') {
        throw new NotFoundError(cls, id);
      } else if (error === 'data') {
        throw new ExistsError(cls, id);
      }
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const result = await this.client.getObject(this.q(cls, id));
      if (result.Body) {
        const body = (await StreamUtil.streamToBuffer(result.Body)).toString('utf8');
        const output = await ModelCrudUtil.load(cls, body);
        if (output) {
          return output;
        }
      }
    } catch (e) {
      // Check for not found
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (item.id) {
      await this.has(cls, item.id!, 'data');
    }
    return this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.has(cls, item.id!, 'notfound');
    return this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.client.putObject(this.q(cls, item.id!, {
      Body: JSON.stringify(item),
      ContentType: 'application/json'
    }));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.client.putObject(this.q(cls, item.id!, {
      Body: JSON.stringify(item),
      ContentType: 'application/json'
    }));
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    await this.has(cls, id);
    await this.client.deleteObject(this.q(cls, id));
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for await (const batch of this.iterateBucket(cls)) {
      for (const item of batch) {
        const resolved = await this.getOptional(cls, item.id);
        if (resolved) {
          yield resolved;
        }
      }
    }
  }

  async upsertStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void> {
    if (meta.size < this.config.chunkSize) { // If bigger than 5 mb
      // Upload to s3
      await this.client.putObject(this.q('_stream', id, {
        Body: await StreamUtil.toBuffer(stream),
        ContentType: meta.contentType,
        ContentLength: meta.size
      }));
    } else {
      await this.writeMultipart(id, stream, meta);
    }
    // Tag after uploading
    await this.client.putObjectTagging(this.q('_stream', id, {
      Tagging: { TagSet: toTagSet(meta) }
    }));
  }

  async getStream(id: string) {
    // Read from s3
    const res = await this.client.getObject(this.q('_stream', id));
    if (res.Body instanceof Buffer || // Buffer
      typeof res.Body === 'string' || // string
      res.Body && ('pipe' in res.Body) // Stream
    ) {
      return StreamUtil.toStream(res.Body);
    }
    throw new Error(`Unable to read type: ${typeof res.Body}`);
  }

  async getStreamMetadata(id: string) {
    const query = this.q('_stream', id);
    const tags = await this.client.getObjectTagging(query);

    return fromTagSet(tags.TagSet!);
  }

  async deleteStream(id: string) {
    await this.client.deleteObject(this.q('_stream', id));
  }

  async createStorage() {
    try {
      await this.client.headBucket({ Bucket: this.config.bucket });
    } catch (e) {
      await this.client.createBucket({ Bucket: this.config.bucket });
    }
  }

  async deleteStorage() {
    for await (const items of this.iterateBucket('')) {
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
