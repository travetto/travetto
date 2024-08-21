import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { buffer as toBuffer, text as toText } from 'node:stream/consumers';
import { ReadableStream } from 'node:stream/web';
import path from 'node:path';
import { createReadStream } from 'node:fs';

import { AppError, castTo, Util } from '@travetto/runtime';

import { BlobMeta, BinaryInput, BlobMetaⲐ, ByteRange } from './types';
import { IOUtil } from './util';

/**
 * Utilities for working with blobs
 */
export class BlobUtil {

  /**
   * Get filename for a given input
   */
  static getFilename(src: Blob | string, meta: Partial<BlobMeta>): string {
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

  static async #blobCore(input: () => Readable, metadata: Partial<BlobMeta>): Promise<Blob> {
    metadata.hash ??= await IOUtil.hashInput(input());
    metadata.contentType = (metadata.contentType || undefined) ?? (await IOUtil.detectType(input())).mime;

    const size = metadata.range ? (metadata.range.end - metadata.range.start) + 1 : metadata.size;
    const out = metadata.filename ?
      new File([], path.basename(metadata.filename), { type: metadata.contentType }) :
      new Blob([], { type: metadata.contentType });

    Object.defineProperties(out, {
      size: { value: size },
      stream: { value: () => ReadableStream.from(input()) },
      arrayBuffer: { value: () => toBuffer(input()) },
      text: { value: () => toText(input()) },
      buffer: { value: () => toBuffer(input()).then(v => new Uint8Array(v)) },
    });

    this.setBlobMeta(out, metadata);

    return out;
  }

  /**
   * Convert input to a blob, containing all data in memory
   */
  static async memoryBlob(src: BinaryInput, metadata: Partial<BlobMeta> = {}): Promise<Blob> {
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
    return await this.#blobCore(input, {
      ...metadata,
      contentType: metadata.contentType ?? src.type,
      size: metadata.size ?? src.size,
      filename: this.getFilename(src, metadata)
    });
  }

  /**
   * Convert input to a blob, backed by lazy stream, will not hash or attempt to detect content type
   */
  static async lazyStreamBlob(src: (() => (Readable | Promise<Readable>)), metadata: Partial<BlobMeta> = {}): Promise<Blob> {
    const input = IOUtil.getLazyStream(src);
    return await this.#blobCore(input, {
      ...metadata,
      hash: metadata.hash ?? Util.uuid(),
      contentType: metadata.contentType || 'application/octet-stream',
    });
  }

  /**
   * Convert file to a blob, backed by file system
   */
  static async fileBlob(src: string, metadata: Partial<BlobMeta> = {}): Promise<File> {
    const input = (): Readable => createReadStream(src, metadata.range);
    const res = await this.#blobCore(input, {
      ...metadata,
      contentType: metadata.contentType || (await IOUtil.detectType(src)).mime,
      size: metadata.size ?? (await fs.stat(src)).size,
      filename: this.getFilename(src, metadata)
    });

    Object.defineProperty(res, 'cleanup', {
      value: () => fs.rm(src, { force: true, recursive: true })
    });

    return castTo(res);
  }

  /**
   * Get blob metadata
   */
  static getBlobMeta(blob: Blob): BlobMeta | undefined {
    return castTo<{ [BlobMetaⲐ]?: BlobMeta }>(blob)[BlobMetaⲐ];
  }

  /**
   * Update or set blob metadata (if missing)
   */
  static updateBlobMeta(blob: Blob, meta: BlobMeta): void {
    const existing = this.getBlobMeta(blob);
    if (existing) {
      Object.assign(existing, meta);
    } else {
      this.setBlobMeta(blob, meta);
    }
  }

  /**
   * Set blob metadata
   */
  static setBlobMeta(blob: Blob, meta: BlobMeta): void {
    castTo<{ [BlobMetaⲐ]?: BlobMeta }>(blob)[BlobMetaⲐ] = meta;
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