import * as mongo from 'mongodb';

import { AssetSource, Asset } from '@travetto/asset';
import { Injectable } from '@travetto/di';

import { MongoAssetConfig } from './config';

@Injectable()
export class MongoAssetSource extends AssetSource {

  private mongoClient: mongo.MongoClient;
  private bucket: mongo.GridFSBucket;

  constructor(private config: MongoAssetConfig) {
    super();
  }

  async postConstruct() {
    this.mongoClient = await mongo.MongoClient.connect(this.config.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    this.bucket = new mongo.GridFSBucket(this.mongoClient.db());
  }

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<void> {
    const writeStream = this.bucket.openUploadStream(file.path, {
      contentType: file.contentType,
      metadata: file.metadata
    });

    stream.pipe(writeStream);

    await new Promise<any>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    let count = 0;

    while (count++ < 5) { // Retry upto 5 times
      try {
        await this.info(file.path);
        return;
      } catch (e) {
        // Wait for load
        await new Promise(res => setTimeout(res, 100));
      }
    }

    throw new Error('Unable to find written file');
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    return this.bucket.openDownloadStreamByName(filename);
  }

  async info(filename: string, filter?: Partial<Asset>): Promise<Asset> {
    const query = { filename };

    if (!!filter) {
      Object.assign(query, filter);
    }

    const files = await this.bucket.find(query).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    const f = files[0];
    return {
      size: f.length,
      path: f.filename,
      contentType: f.contentType,
      stream: undefined as any,
      metadata: f.metadata
    };
  }

  async remove(filename: string): Promise<void> {
    const files = await this.bucket.find({ filename }).toArray();
    const id = files[0]._id;
    return new Promise((resolve, reject) => {
      this.bucket.delete(id, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
