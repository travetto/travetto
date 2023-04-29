import fs from 'fs/promises';
import { createReadStream } from 'fs';
import crypto from 'crypto';
import mime from 'mime';

import { path } from '@travetto/manifest';
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
        hashStream.on('finish', (e?: Error) => e ? rej(e) : res(hasher.read().toString()));
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
    const { default: fileType } = await import('file-type');
    const buffer = await this.readChunk(filePath, 4100);
    return fileType.fromBuffer(buffer);
  }

  /**
   * Convert file name to have proper extension if missing.
   * Extension is determined via mime type if missing.
   */
  static async ensureFileExtension(filePath: string): Promise<string> {
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
  static async resolveFileType(pth: string): Promise<string> {
    let contentType = path.extname(pth);
    const detected = await this.detectFileType(pth);

    if (detected) {
      contentType = detected.mime;
    } else {
      contentType = mime.getType(pth) ?? contentType;
    }

    return contentType;
  }

  /**
   * Convert local file to asset structure
   */
  static async fileToAsset(file: string, metadata: Partial<StreamMeta> = {}): Promise<Asset> {

    const hash = metadata.hash ?? await this.hashFile(file);
    const size = metadata.size ?? (await fs.stat(file)).size;
    const contentType = metadata.contentType ?? await this.resolveFileType(file);
    let filename = metadata.filename;

    if (!filename) {
      filename = path.basename(file);
      if (!filename.includes('.')) {
        const ext = mime.getExtension(contentType);
        if (ext) {
          filename = `${filename}.${ext}`;
        }
      }
    }

    return {
      size,
      filename,
      contentType,
      localFile: file,
      source: createReadStream(file),
      hash
    };
  }
}
