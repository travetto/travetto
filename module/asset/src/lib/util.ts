import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';

import { nodeToPromise } from '@encore/util';

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

