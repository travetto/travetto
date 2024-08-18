import { Readable } from 'node:stream';

import { ModelBlobMeta, ByteRange, ModelBlob } from '../types/blob';

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
   */
  upsertBlob(location: string, input: Blob | Buffer | Readable, meta?: ModelBlobMeta): Promise<void>;

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