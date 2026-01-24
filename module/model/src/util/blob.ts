import { hasFunction } from '@travetto/runtime';
import type { ModelBlobSupport } from '../types/blob.ts';

/**
 * Utilities for processing blobs
 */
export class ModelBlobUtil {

  /**
   * Type guard for determining if service supports blob operations
   */
  static isSupported = hasFunction<ModelBlobSupport>('getBlob');
}