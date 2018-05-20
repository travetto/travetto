import * as aws from 'aws-sdk';
import * as fs from 'fs';

import { Injectable, Inject } from '@travetto/di';
import { AssetSource, Asset } from '@travetto/asset';
import { AssetS3Config } from './config';
import { TagSet } from 'aws-sdk/clients/s3';

function toTagSet(metadata: { [key: string]: any }): TagSet {
  return ['name', 'title', 'hash', 'createdDate', 'tags']
    .filter(x => x in metadata)
    .map(x => ({
      Key: x,
      Value: JSON.stringify(metadata[x])
    }));
}

function fromTagSet(tags: TagSet) {
  const allowed = new Set(['name', 'title', 'hash', 'createdDate', 'tags']);
  const map = tags
    .filter(x => allowed.has(x.Key))
    .map(x => [x.Key, JSON.parse(x.Value)] as [string, string])
    .reduce((acc, pair) => {
      acc[pair[0]] = pair[1];
      return acc;
    }, {} as { [key: string]: any });

  return map;
}

export class AssetS3Source extends AssetSource {

  private client: aws.S3;

  constructor(private config: AssetS3Config) {
    super();
  }

  async postConstruct() {
    this.client = new aws.S3(this.config.config);
    await this.client.createBucket({ Bucket: this.config.bucket }).promise();
  }

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    const conf = { mode: 'w', ...file };
    const upload = this.client.upload({
      Bucket: this.config.bucket,
      Key: file.filename,
      Body: fs.createReadStream(file.path),
    }).promise();

    await upload;

    await this.client.putObjectTagging({
      Bucket: this.config.bucket,
      Key: file.filename,
      Tagging: { TagSet: toTagSet(file.metadata) }
    }).promise()

    let count = 0;

    while (count++ < 5) {
      try {
        return await this.info(file.filename);
      } catch (e) {
        // Wait for load
        await new Promise(res => setTimeout(res, 100));
      }
    }

    throw new Error('Unable to find written file');
  }

  async update(file: Asset): Promise<Asset> {
    const inTags = await this.client.getObjectTagging({
      Bucket: this.config.bucket,
      Key: file.filename
    }).promise();

    const inTagSet = fromTagSet(inTags.TagSet);
    Object.assign(inTagSet, file.metadata);

    const outTags = toTagSet(inTagSet);

    const updateTags = await this.client.putObjectTagging({
      Bucket: this.config.bucket,
      Key: file.filename,
      Tagging: { TagSet: outTags }
    }).promise();

    return file;
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    const res = await this.client.getObject({ Bucket: this.config.bucket, Key: filename }).promise();
    return res.Body! as NodeJS.ReadableStream;
  }

  async info(filename: string, filter?: Partial<AssetMetadata>): Promise<Asset> {
    const query = { filename };

    if (!!filter) {
      Object.assign(query, filter);
    }

    const filesReq = await this.client.listObjects({
      Bucket: this.config.bucket,

    }).promise();

    //.find(query).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    const f = files[0];
    const out: Asset = new Asset(f);
    // Take out of mongo
    out._id = (f as any as { _id: mongo.ObjectId })._id.toHexString();
    return out;
  }

  async find(filter: Partial<AssetMetadata>): Promise<Asset[]> {
    const files = await this.client.files.find(filter).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    return files.map((t: any) => new Asset(t));
  }

  async remove(filename: string): Promise<void> {
    await this.client.deleteObject({ Bucket: this.config.bucket, Key: filename });
    return;
  }
}
