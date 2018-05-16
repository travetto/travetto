import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';
import * as fileType from 'file-type';
import * as util from 'util';
import * as os from 'os';

import { request } from '@travetto/util';
import { Asset, AssetFile } from './model';

const crypto = require('crypto');
const fsStatAsync = util.promisify(fs.stat);
const fsRenameAsync = util.promisify(fs.rename);
const fsReadyAync = util.promisify(fs.read);
const fsOpenAsync = util.promisify(fs.open);

const tmpDir = path.resolve(os.tmpdir());

export class AssetUtil {

  static generateTempFile(ext: string): string {
    const now = new Date();
    const name = `image-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${process.pid}-${(Math.random() * 100000000 + 1).toString(36)}.${ext}`;
    return path.join(tmpDir, name);
  }

  static async localFileToAsset(pth: string, prefix?: string, tags?: string[]) {
    const hash = crypto.createHash('sha256');
    hash.setEncoding('hex');

    const str = fs.createReadStream(pth);
    str.pipe(hash);
    await util.promisify(str.on).call(str, 'end');

    const size = (await fsStatAsync(pth)).size;

    const upload = this.fileToAsset({
      name: pth,
      hash: hash.read(),
      size,
      path: pth,
    }, prefix);

    if (tags) {
      upload.metadata.tags = tags;
    }

    return upload;
  }

  static fileToAsset(upload: AssetFile, prefix?: string): Asset {
    const name = upload.name;
    let type = upload.type as string;
    if (!type || type === 'application/octet-stream') {
      type = mime.getType(name) || type;
    }

    const uploadFile = new Asset({
      filename: name,
      length: upload.size,
      contentType: type,
      path: upload.path,
      metadata: {
        name,
        title: name.replace(/-_/g, ' '),
        hash: upload.hash,
        createdDate: new Date()
      }
    });

    let ext = '';

    if (uploadFile.contentType) {
      ext = mime.getExtension(uploadFile.contentType)!;
    } else if (uploadFile.filename.indexOf('.') > 0) {
      ext = uploadFile.filename.split('.').pop() as string;
    }

    uploadFile.filename = uploadFile.metadata.hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      (prefix || '') + others.slice(0, 5).join('/') + (ext ? `.${ext.toLowerCase()}` : ''));

    return uploadFile;
  }

  static async readChunk(filePath: string, bytes: number) {
    const fd = await fsOpenAsync(filePath, 'r');
    const buffer = new Buffer(bytes);
    const num = await fsReadyAync(fd, buffer, 0, bytes, 0);
    return buffer;
  }

  static async detectFileType(filePath: string) {
    const buffer = await this.readChunk(filePath, 262);
    return fileType(buffer) as { ext: string, mime: string };
  }

  static async downloadUrl(url: string) {
    let filePath = this.generateTempFile(url.split('/').pop() as string);
    const file = fs.createWriteStream(filePath);
    const filePathExt = filePath.indexOf('.') > 0 ? filePath.split('.').pop() : '';
    const res = await request({ url, pipeTo: file });
    let responseExt = mime.getExtension((res.headers['content-type'] as string) || '');

    if (!responseExt) {
      const detectedType = await this.detectFileType(filePath);
      if (detectedType) {
        responseExt = detectedType.ext;
      }
    }
    if (filePathExt !== responseExt && responseExt) {
      let newFilePath = filePath;
      if (filePathExt) {
        newFilePath = newFilePath.replace(`.${filePathExt}`, `.${responseExt}`);
      } else {
        newFilePath += `.${responseExt}`;
      }
      await fsRenameAsync(filePath, newFilePath);
      filePath = newFilePath;
    }
    return filePath;
  }
}
