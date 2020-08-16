import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import * as fileType from 'file-type';
import * as crypto from 'crypto';
import * as mime from 'mime';

import { Asset } from './types';

/**
 * Utilities for processing assets
 */
export class AssetUtil {

  /**
   * Compute hash from a file location on disk
   */
  static async hashFile(pth: string) {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    const str = createReadStream(pth);
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
    const fd = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(bytes);
    await fs.read(fd, buffer, 0, bytes, 0);
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
      await fs.rename(filePath, newFile);
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
  static async fileToAsset(file: string, remote: string = file, metadata: Partial<Asset['metadata']> = {}): Promise<Asset> {
    const hash = metadata.hash ?? await this.hashFile(file);
    const size = (await fs.stat(file)).size;
    const contentType = await this.resolveFileType(file);
    const name = path.basename(file);
    return {
      size,
      path: remote,
      contentType,
      stream: createReadStream(file),
      metadata: {
        name,
        title: name.replace(/-_/g, ' '),
        hash,
        createdDate: new Date(),
        ...(metadata ?? {})
      }
    };
  }
}
