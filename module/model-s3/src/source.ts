import * as s3 from '@aws-sdk/client-s3';
import { Readable } from 'stream';

import { StreamUtil } from '@travetto/boot';
import { AssetSource, Asset } from '@travetto/asset';
import { Injectable } from '@travetto/di';

import { S3AssetConfig } from './config';

function toTagSet(metadata: Asset['metadata']) {
  return (['name', 'title', 'hash', 'createdDate', 'tags'] as const)
    .filter(x => x in metadata)
    .map(x => ({
      Key: x,
      Value: Buffer.from(JSON.stringify(metadata[x])).toString('base64')
    }));
}

function fromTagSet(tags: { Key: string, Value: string }[] = []) {
  const all = ['name', 'title', 'hash', 'createdDate', 'tags'] as const;
  const map = (tags as { Key: (typeof all)[number], Value: string }[])
    .filter(x => all.includes(x.Key))
    .reduce((acc, x) => {
      acc[x.Key] = JSON.parse(Buffer.from(x.Value, 'base64').toString());
      return acc;
    }, {} as Asset['metadata']);

  if (map.createdDate) {
    map.createdDate = new Date(map.createdDate);
  }

  return map;
}

/**
 * Asset source backed by S3
 */
@Injectable()
export class S3AssetSource extends AssetSource {

  private client: s3.S3;

  constructor(private config: S3AssetConfig) {
    super();
  }

  private q<U extends object>(filename: string, extra: U = {} as U) {
    const key = this.config.namespace ? `${this.config.namespace}/${filename}`.replace(/\/+/g, '/') : filename;
    return { Key: key, Bucket: this.config.bucket, ...extra } as (U & { Key: string, Bucket: string });
  }

  /**
   * Create bucket if not present
   */
  async postConstruct() {
    this.client = new s3.S3(this.config.config);
    try {
      await this.client.headBucket({ Bucket: this.config.bucket });
    } catch (e) {
      await this.client.createBucket({ Bucket: this.config.bucket });
    }
  }

  /**
   * Write multipart file upload, in chunks
   */
  async writeMultipart(file: Asset): Promise<void> {
    const { UploadId } = await this.client.createMultipartUpload(this.q(file.path, {
      ContentType: file.contentType,
      ContentLength: file.size,
    }));

    const parts: s3.CompletedPart[] = [];
    let buffers: Buffer[] = [];
    let total = 0;
    let n = 1;
    const flush = async () => {
      if (!total) { return; }
      const part = await this.client.uploadPart(this.q(file.path, {
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
      for await (const chunk of file.stream) {
        buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        total += chunk.length;
        if (total > this.config.chunkSize) {
          await flush();
        }
      }
      await flush();

      await this.client.completeMultipartUpload(this.q(file.path, {
        UploadId,
        MultipartUpload: { Parts: parts }
      }));
    } catch (e) {
      await this.client.abortMultipartUpload(this.q(file.path, { UploadId }));
      throw e;
    }
  }

  async write(file: Asset): Promise<void> {
    if (file.size < this.config.chunkSize) { // If bigger than 5 mb
      // Upload to s3
      const upload = this.client.putObject(this.q(file.path, {
        Body: await StreamUtil.toBuffer(file.stream),
        ContentType: file.contentType,
        ContentLength: file.size
      }));

      await upload;
    } else {
      await this.writeMultipart(file);
    }
    // Tag after uploading
    await this.client.putObjectTagging(this.q(file.path, {
      Tagging: { TagSet: toTagSet(file.metadata) }
    }));
  }

  async read(filename: string): Promise<NodeJS.ReadableStream | Readable> {
    // Read from s3
    const res = await this.client.getObject(this.q(filename));
    if (res.Body instanceof Buffer || // Buffer
      typeof res.Body === 'string' || // string
      res.Body && ('pipe' in res.Body) // Stream
    ) {
      return StreamUtil.toStream(res.Body);
    }
    throw new Error(`Unable to read type: ${typeof res.Body}`);
  }

  async info(filename: string) {
    /**
     * Get details and tags
     */
    const query = this.q(filename);
    const [obj, tags] = await Promise.all([
      this.client.headObject(query),
      this.client.getObjectTagging(query)
    ]);
    return {
      contentType: obj.ContentType!,
      path: filename,
      size: obj.ContentLength!,
      metadata: fromTagSet((tags.TagSet as Parameters<typeof fromTagSet>[0]) || [])
    };
  }

  async delete(filename: string): Promise<void> {
    await this.client.deleteObject(this.q(filename));
  }
}
