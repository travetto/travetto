import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';

import { nodeToPromise } from '@encore/util';

let crypto = require('crypto');
let request = require('request');
let osTmpdir = require('os-tmpdir');
const fileType = require('file-type');
let tmpDir = path.resolve(osTmpdir());

export class AssetUtil {

  static generateTempFile(ext: string): string {
    let now = new Date();
    let name = `image-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${process.pid}-${(Math.random() * 100000000 + 1).toString(36)}.${ext}`;
    return path.join(tmpDir, name);
  }

  static async localFileToAsset(path: string, prefix?: string, tags?: string[]) {
    let hash = crypto.createHash('sha256');
    hash.setEncoding('hex');

    let str = fs.createReadStream(path);
    str.pipe(hash);
    await nodeToPromise(str, str.on, 'end');

    let size = (await nodeToPromise<fs.Stats>(fs, fs.stat, path)).size;

    let upload = AssetUtil.uploadToAsset({
      name: path,
      hash: hash.read(),
      size: size,
      path: path,
    }, prefix);

    if (tags) {
      upload.metadata.tags = tags;
    }

    return upload;
  }

  static uploadToAsset(upload: Express.MultipartyUpload, prefix?: string): File {
    let name = upload.name;
    let type = upload.type as string;
    if (!type || type === 'application/octet-stream') {
      type = mime.lookup(name) || type;
    }

    let uploadFile = new File({
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

    if (uploadFile.contentType) {
      ext = mime.extension(uploadFile.contentType);
    } else if (uploadFile.filename.indexOf('.') > 0) {
      ext = uploadFile.filename.split('.').pop() as string;
    }

    uploadFile.filename = uploadFile.metadata.hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      (prefix || '') + others.slice(0, 5).join('/') + (ext ? '.' + ext.toLowerCase() : ''));

    return uploadFile;
  }

  static readChunk(filePath: string, bytes: number) {
    return new Promise<Buffer>((resolve, reject) => {
      fs.open(filePath, 'r', function (status, fd) {
        if (status) {
          return reject(status);
        }
        let buffer = new Buffer(bytes);
        fs.read(fd, buffer, 0, bytes, 0, function (err, num) {
          if (err) {
            return reject(err);
          } else {
            resolve(buffer);
          }
        });
      });
    });
  }

  static async detectFileType(filePath: string) {
    let buffer = await AssetUtil.readChunk(filePath, 262);
    return fileType(buffer);
  }

  static async downloadUrl(url: string) {
    let filePath = AssetUtil.generateTempFile(url.split('/').pop() as string)
    return new Promise<string>((resolve, reject) => {
      let file = fs.createWriteStream(filePath);
      let req = request.get(url);
      let filePathExt = filePath.indexOf('.') > 0 ? filePath.split('.').pop() : '';
      let responseExt = '';
      req.on('response', (res: any) => {
        responseExt = mime.extension(res.headers['content-type']);
      });
      file.on('finish', async () => {

        if (!responseExt) {
          let detectedType = await AssetUtil.detectFileType(filePath);
          if (detectedType) {
            responseExt = mime.extension(detectedType);
          }
        }
        if (filePathExt !== responseExt && responseExt) {
          let newFilePath = filePath;
          if (filePathExt) {
            newFilePath = newFilePath.replace('.' + filePathExt, '.' + responseExt)
          } else {
            newFilePath += '.' + responseExt;
          }
          await nodeToPromise(fs, fs.rename, filePath, newFilePath);
          filePath = newFilePath;
        }
        resolve(filePath);
      });
      file.on('error', reject);
      req.on('error', reject);
      req.pipe(file);
    });
  }
}

