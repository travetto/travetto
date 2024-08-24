import { Readable } from 'node:stream';
import path from 'node:path';

import { AppError, BinaryInput, BlobMeta, ByteRange, Util } from '@travetto/runtime';

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Get a hashed location/path for a blob
   */
  static getHashedLocation(meta: BlobMeta, prefix = ''): string {
    const hash = meta.hash ?? Util.uuid();

    let parts = hash.match(/(.{1,4})/g)!.slice();
    if (parts.length > 4) {
      parts = [...parts.slice(0, 4), parts.slice(4).join('')];
    }

    const ext = path.extname(meta.filename ?? '') || '.bin';
    return `${parts.join('/')}${ext}`;
  }

  /**
   * Convert input to a blob, containing all data in memory
   */
  static async getInput(src: BinaryInput, metadata: BlobMeta = {}): Promise<[Readable, BlobMeta]> {
    let input: Readable;
    if (src instanceof Blob) {
      metadata = { ...src.meta, ...metadata };
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