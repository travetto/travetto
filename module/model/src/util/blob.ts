import { Readable } from 'node:stream';
import { AppError, BinaryInput, BinaryUtil, BlobMeta, ByteRange, hasFunction } from '@travetto/runtime';
import { ModelBlobSupport } from '../types/blob.ts';

/**
 * Utilities for processing blobs
 */
export class ModelBlobUtil {

  /**
   * Type guard for determining if service supports blob operations
   */
  static isSupported = hasFunction<ModelBlobSupport>('getBlob');

  /**
   * Convert input to a Readable, and get what metadata is available
   */
  static async getInput(input: BinaryInput, metadata: BlobMeta = {}): Promise<[Readable, BlobMeta]> {
    let result: Readable;
    if (input instanceof Blob) {
      metadata = { ...BinaryUtil.getBlobMeta(input), ...metadata };
      metadata.size ??= input.size;
      result = Readable.fromWeb(input.stream());
    } else if (typeof input === 'object' && 'pipeThrough' in input) {
      result = Readable.fromWeb(input);
    } else if (typeof input === 'object' && 'pipe' in input) {
      result = input;
    } else {
      metadata.size = input.length;
      result = Readable.from(input);
    }

    return [result, metadata ?? {}];
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