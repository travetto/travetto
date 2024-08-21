import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';
import path from 'node:path';
import { createReadStream } from 'node:fs';

import { AppError, BlobMeta, ByteRange, castTo, Util, BinaryInput } from '@travetto/runtime';

import { IOUtil } from './util';

/**
 * Utilities for working with blobs
 */
export class BlobUtil {

  /**
   * Get filename for a given input
   */
  static getFilename(src: Blob | string, meta: BlobMeta): string {
    let filename = meta.filename ?? (typeof src === 'string' ? src : undefined);

    // Detect name if missing
    if (!filename) {
      if (typeof src === 'string') {
        filename = path.basename(src);
      } else if (src instanceof File) {
        filename = src.name;
      }
    }

    filename ??= `unknown_${Date.now()}`;

    // Add extension if missing
    if (filename) {
      const extName = path.extname(filename);
      if (!extName && meta.contentType) {
        const ext = IOUtil.getExtension(meta.contentType);
        if (ext) {
          filename = `${filename}.${ext}`;
        }
      }
    }
    return filename;
  }

  /**
   * Convert input to a blob, containing all data in memory
   */
  static async memoryBlob(src: BinaryInput, metadata: BlobMeta = {}): Promise<Blob> {
    if (src instanceof Blob) {
      // Skip
    } else if (typeof src === 'object' && 'pipeThrough' in src) {
      const bytes = await toBuffer(src);
      src = new Blob([bytes]);
    } else if (typeof src === 'object' && 'pipe' in src) {
      src = new Blob([await toBuffer(src)]);
    } else if (Buffer.isBuffer(src)) {
      src = new Blob([src]);
    }

    const input = (): Readable => Readable.from(src.stream());
    metadata.hash ??= await IOUtil.hashInput(input());
    metadata.contentType = (metadata.contentType || undefined) ?? (await IOUtil.detectType(input())).mime;

    return await Util.toBlob(input, {
      ...metadata,
      contentType: metadata.contentType ?? src.type,
      size: metadata.size ?? src.size,
      filename: this.getFilename(src, metadata)
    });
  }

  /**
   * Convert file to a blob, backed by file system
   */
  static async fileBlob(src: string, metadata: BlobMeta = {}): Promise<File> {
    const input = (): Readable => createReadStream(src, metadata.range);
    const res = await Util.toBlob(input, {
      ...metadata,
      contentType: metadata.contentType || (await IOUtil.detectType(src)).mime,
      hash: metadata.hash ?? await IOUtil.hashInput(input()),
      size: metadata.size ?? (await fs.stat(src)).size,
      filename: this.getFilename(src, metadata)
    });

    Object.defineProperty(res, 'cleanup', {
      value: () => fs.rm(src, { force: true, recursive: true })
    });

    return castTo(res);
  }

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange({ start, end }: ByteRange, size: number): Required<ByteRange> {
    // End is inclusive
    end = Math.min(end ?? (size - 1), size - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', 'data');
    }

    return { start, end };
  }

  /**
   * Cleanup if valid
   * @param blob
   */
  static async cleanupBlob(blob: Blob): Promise<void> {
    if ('cleanup' in blob && typeof blob.cleanup === 'function') {
      await blob.cleanup();
    }
  }
}