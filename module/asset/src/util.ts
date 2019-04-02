import * as fs from 'fs';
import * as util from 'util';
import * as mime from 'mime';
import * as fileType from 'file-type';
import * as os from 'os';
import * as crypto from 'crypto';
import { IncomingMessage } from 'http';

import { FsUtil } from '@travetto/base/bootstrap';
import { HttpRequest } from '@travetto/net';

import { Asset, AssetFile } from './model';

const fsStat = util.promisify(fs.stat);
const fsOpen = util.promisify(fs.open);
const fsRead = util.promisify(fs.read);
const fsRename = util.promisify(fs.rename);

const tmpDir = FsUtil.toUnix(os.tmpdir());

export class AssetUtil {

  static generateTempFile(ext: string): string {
    const now = new Date();
    const name = `image-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${process.pid}-${(Math.random() * 100000000 + 1).toString(36)}.${ext}`;
    return FsUtil.resolveUnix(tmpDir, name);
  }

  static async localFileToAsset(pth: string, prefix?: string, tags?: string[]) {
    const hash = crypto.createHash('sha256').setEncoding('hex');

    const str = fs.createReadStream(pth);
    str.pipe(hash);

    await new Promise((res, rej) => {
      str.on('end', e => e ? rej(e) : res());
    });

    const size = (await fsStat(pth)).size;

    const upload = this.fileToAsset({
      name: pth,
      hash: hash.read().toString(),
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
    const fd = await fsOpen(filePath, 'r');
    const buffer = new Buffer(bytes);
    await fsRead(fd, buffer, 0, bytes, 0);
    return buffer;
  }

  static async detectFileType(filePath: string) {
    const buffer = await this.readChunk(filePath, fileType.minimumBytes);
    return fileType(buffer);
  }

  static async downloadUrl(url: string) {
    let filePath = this.generateTempFile(url.split('/').pop() as string);
    const file = fs.createWriteStream(filePath);
    const filePathExt = filePath.indexOf('.') > 0 ? filePath.split('.').pop() : '';
    let responseExt: string | undefined | null;

    await HttpRequest.exec({
      url, responseHandler: async (msg: IncomingMessage) => {
        responseExt = mime.getExtension((msg.headers['content-type'] as string) || '');
        await HttpRequest.pipe(msg, file);
      }
    });

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
        newFilePath = `${newFilePath}.${responseExt}`;
      }
      await fsRename(filePath, newFilePath);
      filePath = newFilePath;
    }
    return filePath;
  }
}
