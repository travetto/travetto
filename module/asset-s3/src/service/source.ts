import * as aws from 'aws-sdk';
import * as fs from 'fs';

import { Injectable, Inject } from '@travetto/di';
import { AssetSource, Asset, AssetMetadata } from '@travetto/asset';
import { AssetS3Config } from './config';
import { TagSet } from 'aws-sdk/clients/s3';

function toTagSet(metadata: AssetMetadata): TagSet {
  return ['name', 'title', 'hash', 'createdDate', 'tags']
    .filter(x => x in metadata)
    .map(x => ({
      Key: x,
      Value: JSON.stringify((metadata as any)[x])
    }));
}

function fromTagSet(tags: TagSet) {
  const allowed = new Set(['name', 'title', 'hash', 'createdDate', 'tags']);
  const map = tags
    .filter(x => allowed.has(x.Key))
    .map(x => [x.Key, JSON.parse(x.Value)] as [string, string])
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
    await this.client.createBucket({ Bucket: this.config.bucket }).promise();
  }

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    const upload = this.client.upload(this.q(file.filename, {
      Body: fs.createReadStream(file.path)
    })).promise();

    await upload;

    await this.client.putObjectTagging(this.q(file.filename, {
      Tagging: { TagSet: toTagSet(file.metadata) }
    })).promise();

    return this.info(file.filename);
  }

  async update(file: Asset): Promise<Asset> {
    const inTags = await this.client.getObjectTagging(this.q(file.filename)).promise();
    const inTagSet = fromTagSet(inTags.TagSet);

    Object.assign(inTagSet, file.metadata);

    const outTags = toTagSet(inTagSet);
    const updateTags = await this.client.putObjectTagging(this.q(file.filename, {
      Tagging: { TagSet: outTags }
    })).promise();

    return file;
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    const res = await this.client.getObject({ Bucket: this.config.bucket, Key: filename }).promise();
    return res.Body! as NodeJS.ReadableStream;
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
