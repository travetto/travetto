import * as mongo from 'mongodb';
import * as Grid from 'gridfs-stream';
import * as util from 'util';

import { Injectable, Inject } from '@encore2/di';
import { AssetSource, Asset } from '@encore2/asset';
import { MongoAssetConfig } from './config';

const setTimeoutAsync = util.promisify(setTimeout);

@Injectable({ target: AssetSource })
export class MongoSource extends AssetSource {

  private client: Grid.Grid;
  private mongoClient: mongo.Db;

  @Inject()
  private config: MongoAssetConfig;

  async postConstruct() {
    this.mongoClient = await mongo.MongoClient.connect(this.config.url);
    this.client = await Grid(this.mongoClient, mongo);
  }

  async write(file: Asset, stream: NodeJS.ReadableStream): Promise<Asset> {
    let conf = Object.assign({ mode: 'w' }, file);
    let writeStream = this.client.createWriteStream(conf);
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

  async update(file: Asset): Promise<Asset> {
    let update = await this.client.files.findOneAndUpdate({ _id: new mongo.ObjectID(file._id) }, {
      $addToSet: { 'metadata.tags': { $each: file.metadata.tags } }
    }, {
        returnOriginal: false
      });
    return new Asset(update.value);
  }

  async read(filename: string): Promise<NodeJS.ReadableStream> {
    return this.client.createReadStream({ filename });
  }

  async info(filename: string, filter?: Partial<Asset>): Promise<Asset> {
    let query = { filename };

    if (!!filter) {
      Object.assign(query, filter);
    }

    let files = await this.client.files.find(query).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    let f = files[0];
    let out = new Asset(f);
    // Take out of mongo
    out._id = f._id.toHexString();
    return out;
  }

  async find(filter: Asset): Promise<Asset[]> {
    let files = await this.client.files.find(filter).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    return files.map((t: any) => new Asset(t));
  }

  async remove(filename: string): Promise<void> {
    await util.promisify(this.client.remove).call(this.client, { filename });
    return;
  }
}
