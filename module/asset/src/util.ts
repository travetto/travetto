import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';

import { getExtension, getType } from 'mime';

import { path } from '@travetto/manifest';
import { StreamMeta } from '@travetto/model';
import { StreamUtil } from '@travetto/base';

import { Asset } from './types';

/**
 * Utilities for processing assets
 */
export class AssetUtil {

  /**
   * Compute hash from a file location on disk or a blob
   */
  static async computeHash(input: string | Blob | Buffer): Promise<string> {
    const hasher = crypto.createHash('sha256').setEncoding('hex');
    const str = typeof input === 'string' ?
      createReadStream(input) :
      Buffer.isBuffer(input) ?
        Readable.from(input) :
        Readable.fromWeb(input.stream());
    await pipeline(str, hasher);
    return hasher.read().toString();
  }

  /**
   * Detect file type
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await StreamUtil.readChunk(input, 4100);
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
    return getExtension(contentType)!;
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
   * Compute hash from a url
   */
  static async hashUrl(url: string, byteLimit = -1): Promise<string> {
    return this.computeHash(await StreamUtil.fetchBytes(url, byteLimit));
  }
}
