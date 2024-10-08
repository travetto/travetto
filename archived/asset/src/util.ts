import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import path from 'node:path';

import { getExtension, getType } from 'mime';

import { StreamMeta } from '@travetto/model';

import { Asset } from './types';

/**
 * Utilities for processing assets
 */
export class AssetUtil {

  /**
   * Compute hash from a file location on disk or a blob
   */
  static async computeHash(input: string | Blob | Buffer): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    const str = typeof input === 'string' ?
      createReadStream(input) :
      Buffer.isBuffer(input) ?
        Readable.from(input) :
        Readable.fromWeb(input.stream());
    await pipeline(str, hash);
    return hash.read().toString();
  }

  /**
   * Read a chunk from a file
   */
  static async readChunk(input: string | Readable | Buffer, bytes: number): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
      return input.subarray(0, bytes);
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
      return Buffer.concat(chunks).subarray(0, bytes);
    }
  }

  /**
   * Detect file type
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await this.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);
    if (typeof input === 'string' && matched?.mime === 'video/mp4' && input.endsWith('.m4a')) {
      return { ext: '.m4a', mime: 'audio/mpeg' };
    }
    if (matched && matched.ext.toString() === 'mpga') {
      return { ext: '.mp3', mime: matched.mime };
    }
    return matched;
  }

  /**
   * Convert file name to have proper extension if missing.
   * Extension is determined via mime type if missing.
   */
  static async ensureFileExtension(filePath: string): Promise<string> {
    const type = await this.resolveFileType(filePath);
    const ext = this.getExtension(type);
    const baseName = path.basename(filePath, path.extname(filePath));
    const newFile = `${baseName}.${ext}`;

    if (filePath !== newFile) {
      await fs.rename(filePath, newFile);
      filePath = newFile;
    }

    return filePath;
  }

  /**
   * Get extension for a given content type
   * @param contentType
   */
  static getExtension(contentType: string): string | undefined {
    const res = getExtension(contentType)!;
    if (res === 'mpga') {
      return 'mp3';
    }
    return res;
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

    const hash = metadata.hash ?? await this.computeHash(file);
    const size = metadata.size ?? (await fs.stat(file)).size;
    const contentType = metadata.contentType ?? await this.resolveFileType(file);
    let filename = metadata.filename;

    if (!filename) {
      filename = path.basename(file);
      const extName = path.extname(file);
      if (!extName) {
        const ext = this.getExtension(contentType);
        if (ext) {
          filename = `${filename}.${ext}`;
        }
      }
    }

    return {
      size,
      filename,
      contentType,
      contentEncoding: metadata.contentEncoding,
      contentLanguage: metadata.contentLanguage,
      cacheControl: metadata.cacheControl,
      localFile: file,
      source: createReadStream(file),
      hash
    };
  }

  /**
   * Convert blob to asset structure
   */
  static async blobToAsset(blob: Blob, metadata: Partial<StreamMeta> = {}): Promise<Asset> {

    const hash = metadata.hash ??= await this.computeHash(blob);
    const size = metadata.size ?? blob.size;
    const contentType = metadata.contentType ?? blob.type;
    let filename = metadata.filename;

    if (!filename) {
      filename = `unknown.${Date.now()}`;
      const ext = this.getExtension(contentType);
      if (ext) {
        filename = `${filename}.${ext}`;
      }
    }

    return {
      size,
      filename,
      contentType,
      contentEncoding: metadata.contentEncoding,
      contentLanguage: metadata.contentLanguage,
      cacheControl: metadata.cacheControl,
      source: Readable.fromWeb(blob.stream()),
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
      throw new Error('Invalid url for hashing');
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
    return this.computeHash(await this.fetchBytes(url, byteLimit));
  }
}
