import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';

import { getExtension, getType } from 'mime';

import { path } from '@travetto/manifest';
import { StreamMeta } from '@travetto/model';
import { AppError } from '@travetto/base';

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
    await pipeline(str, hasher);
    return hasher.read().toString();
  }

  /**
   * Read a chunk from a file, primarily used for mime detection
   */
  static async readChunk(input: string | Readable | Buffer, bytes: number): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
      return input;
    } else if (typeof input === 'string') {
      const fd = await fs.open(input, 'r');
      try {
        const buffer = Buffer.alloc(bytes);
        await fd.read(buffer, 0, bytes, 0);
        return buffer;
      } finally {
        try { fd.close(); } catch { }
      }
    } else {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of input) {
        const bChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(bChunk);
        if ((size += bChunk.length) >= bytes) {
          break;
        }
      }
      return Buffer.concat(chunks);
    }
  }

  /**
   * Detect file type from location on disk
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await this.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);
    if (typeof input === 'string' && matched?.mime === 'video/mp4' && input.endsWith('.m4a')) {
      return { ext: '.m4a', mime: 'audio/mpeg' };
    }
    return matched;
  }

  /**
   * Convert file name to have proper extension if missing.
   * Extension is determined via mime type if missing.
   */
  static async ensureFileExtension(filePath: string): Promise<string> {
    const type = await this.resolveFileType(filePath);
    const ext = getExtension(type);
    const baseName = path.basename(filePath, path.extname(filePath));
    const newFile = `${baseName}.${ext}`;

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
    const detected = await this.detectFileType(pth);
    let contentType: string | undefined | null = undefined;

    if (!detected || detected.mime === 'application/octet-stream') {
      contentType = getType(pth);
    } else {
      contentType = detected.mime;
    }
    return contentType ?? 'application/octet-stream';
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
      const extName = path.extname(file);
      if (!extName) {
        const ext = getExtension(contentType);
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

  /**
   * Fetch bytes from a url
   */
  static async fetchBytes(url: string, byteLimit: number = -1): Promise<Buffer> {
    const str = await fetch(url, {
      headers: (byteLimit > 0) ? {
        Range: `0-${byteLimit - 1}`
      } : {}
    });

    if (!str.ok) {
      throw new AppError('Invalid url for hashing', 'data');
    }

    let count = 0;
    const buffer: Buffer[] = [];

    for await (const chunk of Readable.fromWeb(str.body!)) {
      if (Buffer.isBuffer(chunk)) {
        buffer.push(chunk);
        count += chunk.length;
      } else if (typeof chunk === 'string') {
        buffer.push(Buffer.from(chunk));
        count += chunk.length;
      }

      if (count > byteLimit && byteLimit > 0) {
        break;
      }
    }

    try {
      await str.body?.cancel();
    } catch { }

    return Buffer.concat(buffer, byteLimit <= 0 ? undefined : byteLimit);
  }

  /**
   * Compute hash from a url
   */
  static async hashUrl(url: string, byteLimit = -1): Promise<string> {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    const finalData = await this.fetchBytes(url, byteLimit);
    return hasher.update(finalData).end().read().toString();
  }
}
