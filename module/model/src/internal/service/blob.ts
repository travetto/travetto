import { Readable } from 'node:stream';
import { Class, AppError, BinaryInput, BinaryUtil, BlobMeta, ByteRange } from '@travetto/runtime';
import { ModelType } from '../../types/model.ts';

export const ModelBlobNamespace = '__blobs';
export const MODEL_BLOB: Class<ModelType> = class { id: string; };

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Convert input to a Readable, and get what metadata is available
   */
  static async getInput(src: BinaryInput, metadata: BlobMeta = {}): Promise<[Readable, BlobMeta]> {
    let input: Readable;
    if (src instanceof Blob) {
      metadata = { ...BinaryUtil.getBlobMeta(src), ...metadata };
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
      throw new AppError('Invalid position, out of range', { category: 'data' });
    }

    return { start, end };
  }
}