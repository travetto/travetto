import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';
import * as fileType from 'file-type';

import { nodeToPromise } from '@encore2/base';
import { request } from '@encore2/util';
import { Asset, AssetFile } from './model';

const osTmpdir = require('os-tmpdir');
const crypto = require('crypto');

let tmpDir = path.resolve(osTmpdir());


export class AssetUtil {

  static generateTempFile(ext: string): string {
    let now = new Date();
    let name = `image-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${process.pid}-${(Math.random() * 100000000 + 1).toString(36)}.${ext}`;
    return path.join(tmpDir, name);
  }

  static async localFileToAsset(pth: string, prefix?: string, tags?: string[]) {
    let hash = crypto.createHash('sha256');
    hash.setEncoding('hex');

    let str = fs.createReadStream(pth);
    str.pipe(hash);
    await nodeToPromise(str, str.on, 'end');

    let size = (await nodeToPromise<fs.Stats>(fs, fs.stat, pth)).size;

    let upload = this.fileToAsset({
      name: pth,
      hash: hash.read(),
      size: size,
      path: pth,
    }, prefix);

    if (tags) {
      upload.metadata.tags = tags;
    }

    return upload;
  }

  static fileToAsset(upload: AssetFile, prefix?: string): Asset {
    let name = upload.name;
    let type = upload.type as string;
    if (!type || type === 'application/octet-stream') {
      type = mime.lookup(name) || type;
    }

    let uploadFile = new Asset({
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
    let buffer = await this.readChunk(filePath, 262);
    return fileType(buffer) as { ext: string, mime: string };
  }

  static async downloadUrl(url: string) {
    let filePath = this.generateTempFile(url.split('/').pop() as string);
    let file = fs.createWriteStream(filePath);
    let filePathExt = filePath.indexOf('.') > 0 ? filePath.split('.').pop() : '';
    let res = await request({ url, pipeTo: file });
    let responseExt = mime.extension((res.headers['content-type'] as string) || '');

    if (!responseExt) {
      let detectedType = await this.detectFileType(filePath);
      if (detectedType) {
        responseExt = detectedType.ext;
      }
    }
    if (filePathExt !== responseExt && responseExt) {
      let newFilePath = filePath;
      if (filePathExt) {
        newFilePath = newFilePath.replace('.' + filePathExt, '.' + responseExt);
      } else {
        newFilePath += '.' + responseExt;
      }
      await nodeToPromise(fs, fs.rename, filePath, newFilePath);
      filePath = newFilePath;
    }
    return filePath;
  }
}

