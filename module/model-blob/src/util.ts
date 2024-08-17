import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import path from 'node:path';

import { getExtension, getType } from 'mime';

import { AppError, castTo } from '@travetto/runtime';
import { ExistsError, NotFoundError } from '@travetto/model';

import { BlobMeta, BlobRange, BlobWithMeta } from './types';
import { ModelBlobSupport } from './service';
import { BlobDataUtil } from './data';

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange({ start, end }: BlobRange, size: number): Required<BlobRange> {
    end = Math.min(end ?? size - 1, size - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', 'data');
    }

    return { start, end };
  }

  /**
   * Ensure unique
   */
  static async ensureUnique(storage: ModelBlobSupport, location: string, overwriteIfFound = false): Promise<void> {
    if (!overwriteIfFound) {
      let missing = false;
      try {
        await storage.describeBlob(location);
      } catch (err) {
        if (err instanceof NotFoundError) {
          missing = true;
        } else {
          throw err;
        }
      }
      if (!missing) {
        throw new ExistsError('Asset', location);
      }
    }
  }

  /**
   * Detect file type
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await this.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);
    if (matched?.ext === 'wav') {
      return { ext: '.wav', mime: 'audio/wav' };
    }
    if (typeof input === 'string' && matched?.mime === 'video/mp4' && input.endsWith('.m4a')) {
      return { ext: '.m4a', mime: 'audio/mp4' };
    }
    if (matched?.ext === castTo('mpga')) {
      return { ext: '.mp3', mime: 'audio/mpeg' };
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
  static async fileToBlobWitMeta(file: string, metadata: Partial<BlobMeta> = {}): Promise<BlobWithMeta> {
    const hash = metadata.hash ?? await BlobDataUtil.computeHash(file);
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

    return new BlobWithMeta(
      () => createReadStream(filename),
      {
        ...metadata,
        size,
        filename,
        contentType,
        hash
      }
    );
  }

  /**
   * Convert blob to asset structure
   */
  static async blobToBlobWithMeta(blob: Blob, metadata: Partial<BlobMeta> = {}): Promise<BlobWithMeta> {

    const hash = metadata.hash ??= await BlobDataUtil.computeHash(blob);
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

    return new BlobWithMeta(
      () => Readable.fromWeb(blob.stream()),
      {
        ...metadata,
        size,
        filename,
        contentType,
        hash
      }
    );
  }
}
