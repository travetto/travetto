import * as fs from 'fs';
import * as mongo from 'mongodb';
import * as Grid from 'gridfs-stream';
import * as mime from 'mime';

import { MongoService } from '@encore/mongo';
import { File } from '../model';
import { nodeToPromise } from '@encore/util';
import { generateTempFile } from '../util';

let crypto = require('crypto');
let request = require('request');
const fileType = require('file-type');

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
      throw new Error('Unable to find file');
    }

    return files.map((t: any) => new File(t));
  }

  static fromUpload(upload: Express.MultipartyUpload, prefix?: string): File {
    let name = upload.name;
    let type = upload.type as string;
    if (!type || type === 'application/octet-stream') {
      type = mime.lookup(name) || type;
    }

    let f = new File({
      filename: name,
      length: upload.size,
      contentType: type,
      path: upload.path,
      metadata: {
        name: name,
        title: name.replace(/-_/g, ' '),
        hash: upload.hash,
        createdDate: new Date()
      }
    });

    let ext = '';
    if (f.contentType) {
      ext = mime.extension(f.contentType);
    } else if (f.filename.indexOf('.') > 0) {
      ext = f.filename.split('.').pop() as string;
    }
    f.filename = f.metadata.hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      (prefix || '') + others.slice(0, 5).join('/') + (ext ? '.' + ext.toLowerCase() : ''));
    return f;
  }

  static async uploadFromPath(path: string, prefix?: string, tags?: string[]) {
    let hash = crypto.createHash('sha256');
    hash.setEncoding('hex');

    let str = fs.createReadStream(path);
    str.pipe(hash);
    await nodeToPromise(str, str.on, 'end');

    let size = (await nodeToPromise<fs.Stats>(fs, fs.stat, path)).size;

    let upload = AssetService.fromUpload({
      name: path,
      hash: hash.read(),
      size: size,
      path: path,
    }, prefix);

    if (tags) {
      upload.metadata.tags = tags;
    }
    return await AssetService.upload(upload, true, false);
  }

  static async writeFile(file: File, stream: NodeJS.ReadableStream) {
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

  static async getInfo(filename: string, filter?: any): Promise<File> {
    let gfs = await AssetService.getClient();
    let query = { filename };

    if (!!filter) {
      Object.assign(query, filter);
    }

    let files = await gfs.files.find(query).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }
    let f = files[0];
    let out = new File(f);
    // Take out of mongo
    out._id = f._id.toHexString();
    return out;
  }

  static async remove(filename: string): Promise<void> {
    let gfs = await AssetService.getClient();
    await nodeToPromise(gfs, gfs.remove, { filename });
    return;
  }

  static async upload(upload: File, upsert = true, removeOnComplete = true) {
    try {
      let res: File | null = null;
      try {
        res = await AssetService.getInfo(upload.filename);
      } catch (e) {
        // Not found
      }

      if (res) {
        if (!upsert) {
          throw new Error(`File already exists: ${upload.filename}`);
        } else if (upload.metadata.tags && upload.metadata.tags.length) {
          let gfs = await AssetService.getClient();
          let update = await gfs.files.findOneAndUpdate({ _id: new mongo.ObjectID(res._id) }, {
            $addToSet: { 'metadata.tags': { $each: upload.metadata.tags } }
          }, {
              returnOriginal: false
            });
          res = new File(update.value);
        }
        return res;
      } else {
        await AssetService.writeFile(upload, fs.createReadStream(upload.path));
        return upload;
      }

    } finally {
      if (removeOnComplete) {
        fs.unlink(upload.path);
      }
    }
  }

  static async uploadAll(uploads: File[]) {
    return await Promise.all(uploads.map(u => AssetService.upload(u)));
  }

  static async get(filename: string, filter?: any): Promise<File> {
    let info = await AssetService.getInfo(filename, filter);
    if (info.metadata.title) {
      info.filename = info.metadata.title;
    }
    info.stream = await AssetService.readFile(filename);
    return info;
  }
  static async uploadUrl(url: string, tags?: string[], prefix?: string): Promise<File> {
    let filePath = generateTempFile(url.split('/').pop() as string)
    let promise: Promise<File> = new Promise((resolve, reject) => {
      let file = fs.createWriteStream(filePath);
      let req = request.get(url);
      let type = '';
      req.on('data', (chunk: any) => {
        req.destroy();
          if (fileType(chunk)) {
            type = fileType(chunk).mime;
          }
      });
      if (type === undefined) {
        req.on('response', (res: any) => {
        type = res.headers['content-type'];
        });
      }
      file.on('finish', () => {
        AssetService.uploadFromPath(filePath, prefix, tags, type).then(resolve, reject);
      });
      file.on('error', reject);
      req.on('error', reject);
      req.pipe(file);
    });
    try {
      return await promise;
    } finally {
      try {
        fs.unlink(filePath);
      } catch (e) {
            
      }
    }
  }
}