import * as mongo from 'mongodb';
import * as Grid from 'gridfs-stream';
import * as util from 'util';

import { Injectable, Inject } from '@travetto/di';
import { AssetSource, Asset } from '@travetto/asset';
import { AssetMongoConfig } from './config';

const setTimeoutAsync = util.promisify(setTimeout);

export class AssetMongoSource extends AssetSource {

  private client: Grid.Grid;
  private mongoClient: mongo.MongoClient;

  constructor(private config: AssetMongoConfig) {
    super();
  }

  async postConstruct() {
    this.mongoClient = await mongo.MongoClient.connect(this.config.url);
    this.client = await Grid(this.mongoClient.db(), mongo);
  }

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    const conf = { mode: 'w', ...file };
    const writeStream = this.client.createWriteStream(conf);
    writeStream.options.content_type = conf.contentType;
    stream.pipe(writeStream);

    await new Promise<any>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    let count = 0;

    while (count++ < 5) {
      try {
        return await this.info(file.filename);
      } catch (e) {
        // Wait for load
        await setTimeoutAsync(100);
      }
    }

    throw new Error('Unable to find written file');
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    return this.client.createReadStream({ filename });
  }

  async info(filename: string, filter?: Partial<Asset>): Promise<Asset> {
    const query = { filename };

    if (!!filter) {
      Object.assign(query, filter);
    }

    const files = await this.client.files.find(query).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    const f = files[0];
    const out: Asset = new Asset(f);
    delete f['_id'];
    return out;
  }

  async remove(filename: string): Promise<void> {
    await util.promisify(this.client.remove).call(this.client, { filename });
    return;
  }
}
