import { AppError, hasFunction, type ByteRange } from '@travetto/runtime';
import type { ModelBlobSupport } from '../types/blob.ts';

/**
 * Utilities for processing blobs
 */
export class ModelBlobUtil {

  /**
   * Type guard for determining if service supports blob operations
   */
  static isSupported = hasFunction<ModelBlobSupport>('getBlob');

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange({ start, end }: ByteRange, size: number): Required<ByteRange> {
    // End is inclusive
    end = Math.min(end ?? (size - 1), size - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', { category: 'data', details: { start, end, size } });
    }

    return { start, end };
  }
}