import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as fileType from 'file-type';
import * as crypto from 'crypto';
import * as mime from 'mime';

import { Asset } from './types';

const fsRead = util.promisify(fs.read);
const fsOpen = util.promisify(fs.open);
const fsStat = util.promisify(fs.stat);
const fsRename = util.promisify(fs.rename);

/**
 * Utilities for processing assets
 */
export class AssetUtil {

  /**
   * Compute hash from a file location on disk
   */
  static async hashFile(pth: string) {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    const str = fs.createReadStream(pth);
    const hashStream = str.pipe(hasher);

    await new Promise((res, rej) => {
      hashStream.on('finish', e => e ? rej(e) : res());
    });
    return hasher.read().toString() as string;
  }

  /**
   * Read a chunk from a file, primarily used for mime detection
   */
  static async readChunk(filePath: string, bytes: number) {
    const fd = await fsOpen(filePath, 'r');
    const buffer = Buffer.alloc(bytes);
    await fsRead(fd, buffer, 0, bytes, 0);
    return buffer;
  }

  /**
   * Detect file type from location on disk
   */
  static async detectFileType(filePath: string) {
    const buffer = await this.readChunk(filePath, 4100);
    return fileType.fromBuffer(buffer);
  }

  /**
   * Convert file name to have proper extension if missing.
   * Extension is determined via mime type if missing.
   */
  static async ensureFileExtension(filePath: string) {
    const type = await this.resolveFileType(filePath);
    const ext = mime.getExtension(type);
    const newFile = filePath.replace(/[.][^.]+$/, ext!);

    if (filePath !== newFile) {
      await fsRename(filePath, newFile);
      filePath = newFile;
    }

    return filePath;
  }

  /**
   * Read content type from location on disk
   */
  static async resolveFileType(pth: string) {
    let contentType: string = path.extname(pth);
    const detected = await this.detectFileType(pth);

    if (detected) {
      contentType = detected.mime;
    }

    return contentType;
  }

  /**
   * Convert local file to asset structure
   */
  static async fileToAsset(file: string, remote: string = file, metadata: Partial<Asset> = {}): Promise<Asset & { stream: NodeJS.ReadableStream }> {
    const hash = metadata.hash ?? await this.hashFile(file);
    const size = metadata.size ?? (await fsStat(file)).size;
    const contentType = metadata.contentType ?? await this.resolveFileType(file);

    return {
      size,
      filename: remote,
      contentType,
      stream: fs.createReadStream(file),
      hash
    };
  }
}
