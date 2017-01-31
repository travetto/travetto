import * as fs from 'fs';
import * as mongo from 'mongodb';
import * as Grid from 'gridfs-stream';

import { AppError } from '@encore/express';
import { MongoService } from '@encore/mongo';
import { Asset } from '../model';
import { nodeToPromise } from '@encore/util';

export class AssetService {

  private static clientPromise: Promise<Grid.Grid>;

  static getClient() {
    if (!AssetService.clientPromise) {
      AssetService.clientPromise = (async () => {
        let db = await MongoService.getClient();
        return Grid(db, mongo);
      })();
    }
    return AssetService.clientPromise;
  }

  static async getByQuery(filter: any) {
    let gfs = await AssetService.getClient();
    let files = await gfs.files.find(filter).toArray();

    if (!files || !files.length) {
      throw new AppError('Unable to find file', 404);
    }

    return files.map((t: any) => new Asset(t));
  }

  static async writeFile(file: Asset, stream: NodeJS.ReadableStream) {
    let gfs = await AssetService.getClient();
    let conf = Object.assign({ mode: 'w' }, file);
    let writeStream = gfs.createWriteStream(conf);

    stream.pipe(writeStream);

    return new Promise<any>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  static async readFile(filename: string): Promise<NodeJS.ReadableStream> {
    let gfs = await AssetService.getClient();
    return gfs.createReadStream({ filename });
  }

  static async getInfo(filename: string, filter?: any): Promise<Asset> {
    let gfs = await AssetService.getClient();
    let query = { filename };

    if (!!filter) {
      Object.assign(query, filter);
    }

    let files = await gfs.files.find(query).toArray();

    if (!files || !files.length) {
      throw new AppError('Unable to find file', 404);
    }
    let f = files[0];
    let out = new Asset(f);
    // Take out of mongo
    out._id = f._id.toHexString();
    return out;
  }

  static async remove(filename: string): Promise<void> {
    let gfs = await AssetService.getClient();
    await nodeToPromise(gfs, gfs.remove, { filename });
    return;
  }

  static async upload(upload: Asset, upsert = true, removeOnComplete = true) {
    try {
      let res: Asset | null = null;
      try {
        res = await AssetService.getInfo(upload.filename);
      } catch (e) {
        // Not found
      }

      if (res) {
        if (!upsert) {
          throw new AppError(`File already exists: ${upload.filename}`, 409);
        } else if (upload.metadata.tags && upload.metadata.tags.length) {
          let gfs = await AssetService.getClient();
          let update = await gfs.files.findOneAndUpdate({ _id: new mongo.ObjectID(res._id) }, {
            $addToSet: { 'metadata.tags': { $each: upload.metadata.tags } }
          }, {
              returnOriginal: false
            });
          res = new Asset(update.value);
        }
        return res;
      } else {
        await AssetService.writeFile(upload, fs.createReadStream(upload.path));
        let found = false;
        while (!found) {
          try {
            await AssetService.getInfo(upload.filename);
            found = true;
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) { }
        }
        return upload;
      }

    } finally {
      if (removeOnComplete) {
        nodeToPromise(fs, fs.unlink, upload.path);
      }
    }
  }

  static async uploadAll(uploads: Asset[]) {
    return await Promise.all(uploads.map(u => AssetService.upload(u)));
  }

  static async get(filename: string, filter?: any): Promise<Asset> {
    let info = await AssetService.getInfo(filename, filter);
    if (info.metadata.title) {
      info.filename = info.metadata.title;
    }
    info.stream = await AssetService.readFile(filename);
    return info;
  }
}