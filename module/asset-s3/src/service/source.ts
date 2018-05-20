import * as aws from 'aws-sdk';
import * as fs from 'fs';

import { Injectable, Inject } from '@travetto/di';
import { AssetSource, Asset, AssetMetadata } from '@travetto/asset';
import { AssetS3Config } from './config';
import { TagSet } from 'aws-sdk/clients/s3';
import { Readable } from 'stream';

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

export class AssetS3Source extends AssetSource {

  private client: aws.S3;

  constructor(private config: AssetS3Config) {
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
    const upload = this.client.upload(this.q(file.filename, {
      Body: fs.createReadStream(file.path),
      ContentType: file.contentType,
      ContentLength: file.length
    })).promise();

    await upload;

    await this.client.putObjectTagging(this.q(file.filename, {
      Tagging: { TagSet: toTagSet(file.metadata) }
    })).promise();

    return this.info(file.filename);
  }

  async read(filename: string): Promise<NodeJS.ReadableStream | Readable> {
    const res = await this.client.getObject({ Bucket: this.config.bucket, Key: filename }).promise();
    if (res.Body instanceof Buffer || typeof res.Body === 'string') {
      const strm = new Readable();
      strm._read = () => { };
      strm.push(res.Body);
      strm.push(null);
      return strm;
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
    return new Asset({
      contentType: obj.ContentType,
      filename,
      length: obj.ContentLength,
      metadata: fromTagSet(tags.TagSet)
    });
  }

  async remove(filename: string): Promise<void> {
    await this.client.deleteObject({ Bucket: this.config.bucket, Key: filename });
    return;
  }
}
