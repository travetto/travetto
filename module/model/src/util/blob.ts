import { Readable } from 'node:stream';

import { AppError, BinaryInput, BlobMeta, BlobUtil, ByteRange, Util } from '@travetto/runtime';
import { IOUtil } from '@travetto/io';

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Get a hashed location/path for a blob
   */
  static getHashedLocation(meta: BlobMeta, prefix = ''): string {
    const hash = meta.hash ?? Util.uuid();

    const base = hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (_, ...others) =>
      `${prefix}${others.slice(0, 5).join('/')}`);

    return IOUtil.getFilename(base, meta.contentType);
  }

  /**
   * Convert input to a blob, containing all data in memory
   */
  static async getInput(src: BinaryInput, metadata: BlobMeta = {}): Promise<[Readable, BlobMeta]> {
    let input: Readable;
    if (src instanceof Blob) {
      metadata = { ...BlobUtil.getBlobMeta(src), ...metadata };
      metadata.size ??= src.size;
      input = Readable.fromWeb(src.stream());
    } else if (typeof src === 'object' && 'pipeThrough' in src) {
      input = Readable.fromWeb(src);
    } else if (typeof src === 'object' && 'pipe' in src) {
      input = src;
    } else {
      metadata.size = src.length;
      input = Readable.from(src);
    }

    return [input, metadata ?? {}];
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
}