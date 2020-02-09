import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as fileType from 'file-type';
import * as crypto from 'crypto';
import * as mime from 'mime';

import { Asset, AssetMetadata } from './types';

const fsStat = util.promisify(fs.stat);
const fsOpen = util.promisify(fs.open);
const fsRead = util.promisify(fs.read);
const fsRename = util.promisify(fs.rename);

export class AssetUtil {

  static async hashFile(pth: string) {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    const str = fs.createReadStream(pth);
    const hashStream = str.pipe(hasher);

    await new Promise((res, rej) => {
      hashStream.on('finish', e => e ? rej(e) : res());
    });
    return hasher.read().toString() as string;
  }

  static async readChunk(filePath: string, bytes: number) {
    const fd = await fsOpen(filePath, 'r');
    const buffer = Buffer.alloc(bytes);
    await fsRead(fd, buffer, 0, bytes, 0);
    return buffer;
  }

  static async detectFileType(filePath: string) {
    const buffer = await this.readChunk(filePath, 4100);
    return fileType.fromBuffer(buffer);
  }

  static async coerceFileType(filePath: string) {

    const type = await this.resolveFileType(filePath);
    const ext = mime.getExtension(type);
    const newFile = filePath.replace(/[.][^.]+$/, ext!);

    if (filePath !== newFile) {
      await fsRename(filePath, newFile);
      filePath = newFile;
    }

    return filePath;
  }

  static async resolveFileType(pth: string) {
    let contentType: string = path.extname(pth);
    const detected = await this.detectFileType(pth);

    if (detected) {
      contentType = detected.mime;
    }

    return contentType;
  }

  static async fileToAsset(file: string, metadata: Partial<AssetMetadata> = {}): Promise<Asset> {
    let hash: string | undefined = metadata.hash;

    if (!hash) {
      hash = await this.hashFile(file);
    }

    const size = (await fsStat(file)).size;
    const contentType = await this.resolveFileType(file);

    return {
      size,
      path: file,
      contentType,
      stream: fs.createReadStream(file),
      metadata: {
        name: path.basename(file),
        title: path.basename(file).replace(/-_/g, ' '),
        hash: hash!,
        createdDate: new Date(),
        ...(metadata ?? {})
      }
    };
  }
}
