import * as aws from 'aws-sdk';
import { TagSet } from 'aws-sdk/clients/s3';
import { Readable } from 'stream';

import { StreamUtil } from '@travetto/boot';
import { AssetSource, Asset } from '@travetto/asset';
import { Injectable } from '@travetto/di';

import { S3AssetConfig } from './config';

function toTagSet(metadata: Asset['metadata']): TagSet {
  return (['name', 'title', 'hash', 'createdDate', 'tags'] as const)
    .filter(x => x in metadata)
    .map(x => ({
      Key: x,
      Value: Buffer.from(JSON.stringify(metadata[x])).toString('base64')
    }));
}

function fromTagSet(tags: TagSet) {
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

  private client: aws.S3;

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
    this.client = new aws.S3(this.config.config);
    try {
      await this.client.headBucket({ Bucket: this.config.bucket }).promise();
    } catch (e) {
      await this.client.createBucket({ Bucket: this.config.bucket }).promise();
    }
  }

  async write(file: Asset): Promise<void> {
    // Upload to s3
    const upload = this.client.upload(this.q(file.path, {
      Body: file.stream,
      ContentType: file.contentType,
      ContentLength: file.size
    })).promise();

    await upload;

    // Tag after uploading
    await this.client.putObjectTagging(this.q(file.path, {
      Tagging: { TagSet: toTagSet(file.metadata) }
    })).promise();
  }

  async read(filename: string): Promise<NodeJS.ReadableStream | Readable> {
    // Read from s3
    const res = await this.client.getObject(this.q(filename)).promise();
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
      this.client.headObject(query).promise(),
      this.client.getObjectTagging(query).promise()
    ]);
    return {
      contentType: obj.ContentType!,
      path: filename,
      size: obj.ContentLength!,
      metadata: fromTagSet(tags.TagSet)
    };
  }

  async delete(filename: string): Promise<void> {
    await this.client.deleteObject(this.q(filename)).promise();
  }
}
