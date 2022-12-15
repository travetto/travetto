import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as crypto from 'crypto';
import { getExtension, getType } from 'mime';

import { path } from '@travetto/boot';
import { StreamMeta } from '@travetto/model';

import { Asset } from './types';

/**
 * Utilities for processing assets
 */
export class AssetUtil {

  /**
   * Compute hash from a file location on disk
   */
  static async hashFile(pth: string): Promise<string> {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    const str = createReadStream(pth);
    const hashStream = str.pipe(hasher);
    try {
      return await new Promise<string>((res, rej) => {
        hashStream.on('finish', e => e ? rej(e) : res(hasher.read().toString()));
      });
    } finally {
      try { str.close(); } catch { }
    }
  }

  /**
   * Read a chunk from a file, primarily used for mime detection
   */
  static async readChunk(filePath: string, bytes: number): Promise<Buffer> {
    const fd = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      await fd.read(buffer, 0, bytes, 0);
      return buffer;
    } finally {
      try { fd.close(); } catch { }
    }
  }

  /**
   * Detect file type from location on disk
   */
  static async detectFileType(filePath: string): Promise<{ ext: string, mime: string } | undefined> {
    const fileType = await import('file-type');
    const buffer = await this.readChunk(filePath, 4100);
    return fileType.fromBuffer(buffer);
  }

  /**
   * Convert file name to have proper extension if missing.
   * Extension is determined via mime type if missing.
   */
  static async ensureFileExtension(filePath: string): Promise<string> {
    const type = await this.resolveFileType(filePath);
    const ext = getExtension(type);
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
  static async resolveFileType(pth: string): Promise<string> {
    let contentType = path.extname(pth);
    const detected = await this.detectFileType(pth);

    if (detected) {
      contentType = detected.mime;
    } else {
      contentType = getType(pth) ?? contentType;
    }

    return contentType;
  }

  /**
   * Convert local file to asset structure
   */
  static async fileToAsset(file: string, remote: string = file, metadata: Partial<StreamMeta> = {}): Promise<Asset> {
    const hash = metadata.hash ?? await this.hashFile(file);
    const size = metadata.size ?? (await fs.stat(file)).size;
    const contentType = metadata.contentType ?? await this.resolveFileType(file);

    return {
      size,
      filename: remote,
      contentType,
      stream: () => createReadStream(file),
      hash
    };
  }
}
