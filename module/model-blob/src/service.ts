import { ClassInstance } from '@travetto/runtime';
import { BlobMeta, BlobRange, BlobResponse, BlobWithMeta } from './types';

/**
 * Support for Blobs CRD.  Blob update is not supported.
 *
 * @concrete ../internal/service/common#ModelBlobSupportTarget
 */
export interface ModelBlobSupport {

  /**
   * Upsert blob to storage
   * @param location The location of the blob
   * @param input The actual blob to write
   * @param meta The blob metadata
   */
  upsertBlob(location: string, input: BlobWithMeta): Promise<void>;

  /**
   * Get blob from storage
   * @param location The location of the blob
   */
  getBlob(location: string, range?: BlobRange): Promise<BlobResponse>;

  /**
   * Get metadata for blob
   * @param location The location of the blob
   */
  describeBlob(location: string): Promise<BlobMeta>;

  /**
   * Delete blob by location
   * @param location The location of the blob
   */
  deleteBlob(location: string): Promise<void>;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isBlobSupported(o: ClassInstance): o is ModelBlobSupport {
  return !!o && 'getBlob' in o;
}

