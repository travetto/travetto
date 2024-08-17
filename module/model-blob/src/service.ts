import { ClassInstance } from '@travetto/runtime';
import { ModelBlobMeta, ByteRange, ModelBlob } from './types';

/**
 * Support for Blobs CRD.  Blob update is not supported.
 *
 * @concrete ./internal/types#ModelBlobSupportTarget
 */
export interface ModelBlobSupport {

  /**
   * Upsert blob to storage
   * @param location The location of the blob
   * @param input The actual blob to write
   */
  upsertBlob(location: string, input: ModelBlob | Blob): Promise<void>;

  /**
   * Get blob from storage
   * @param location The location of the blob
   */
  getBlob(location: string, range?: ByteRange): Promise<ModelBlob>;

  /**
   * Get metadata for blob
   * @param location The location of the blob
   */
  describeBlob(location: string): Promise<ModelBlobMeta>;

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

