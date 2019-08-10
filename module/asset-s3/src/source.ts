import * as aws from 'aws-sdk';
import { TagSet } from 'aws-sdk/clients/s3';
import { Readable } from 'stream';

import { SystemUtil } from '@travetto/base';
import { AssetSource, Asset, AssetMetadata } from '@travetto/asset';
import { Injectable } from '@travetto/di';

import { S3AssetConfig } from './config';

function toTagSet(metadata: AssetMetadata): TagSet {
  return ['name', 'title', 'hash', 'createdDate', 'tags']
    .filter(x => x in metadata)
    .map(x => ({
      Key: x,
      Value: new Buffer(JSON.stringify((metadata as any)[x])).toString('base64')
    }));
}

function fromTagSet(tags: TagSet) {
  const allowed = new Set(['name', 'title', 'hash', 'createdDate', 'tags']);
  const map = tags
    .filter(x => allowed.has(x.Key))
    .map(x => [x.Key, JSON.parse(new Buffer(x.Value, 'base64').toString())] as [string, string])
    .reduce((acc, pair) => {
      (acc as any)[pair[0]] = pair[1];
      return acc;
    }, {} as AssetMetadata);

  return map;
}

@Injectable()
export class S3AssetSource extends AssetSource {

  private client: aws.S3;

  constructor(private config: S3AssetConfig) {
    super();
  }

  private q<U extends object>(filename: string, extra: U = {} as U) {
    return { Key: filename, Bucket: this.config.bucket, ...(extra as any) } as (U & { Key: string, Bucket: string });
  }

  async postConstruct() {
    this.client = new aws.S3(this.config.config);
    try {
      await this.client.headBucket({ Bucket: this.config.bucket }).promise();
    } catch (e) {
      await this.client.createBucket({ Bucket: this.config.bucket }).promise();
    }
  }

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    const upload = this.client.upload(this.q(file.path, {
      Body: stream,
      ContentType: file.contentType,
      ContentLength: file.size
    })).promise();

    await upload;

    await this.client.putObjectTagging(this.q(file.path, {
      Tagging: { TagSet: toTagSet(file.metadata) }
    })).promise();

    return this.info(file.path);
  }

  async read(filename: string): Promise<NodeJS.ReadableStream | Readable> {
    const res = await this.client.getObject({ Bucket: this.config.bucket, Key: filename }).promise();
    if (res.Body instanceof Buffer) {
      return SystemUtil.toReadable(res.Body);
    } else if (typeof res.Body === 'string') {
      return SystemUtil.toReadable(Buffer.from(res.Body, 'utf8'));
    } else if (res.Body && ('pipe' in res.Body)) {
      return res.Body as NodeJS.ReadableStream;
    }
    throw new Error(`Unable to read type: ${typeof res.Body}`);
  }

  async info(filename: string): Promise<Asset> {
    const query = this.q(filename);
    const [obj, tags] = await Promise.all([
      this.client.getObject(query).promise(),
      this.client.getObjectTagging(query).promise()
    ]);
    return {
      contentType: obj.ContentType!,
      path: filename,
      stream: undefined as any,
      size: obj.ContentLength!,
      metadata: fromTagSet(tags.TagSet)
    };
  }

  async remove(filename: string): Promise<void> {
    await this.client.deleteObject({ Bucket: this.config.bucket, Key: filename });
    return;
  }
}
