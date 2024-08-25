import { BinaryInput, BlobMeta, ByteRange } from '@travetto/runtime';

/**
 * Support for Blobs CRUD.
 *
 * @concrete ../internal/service/common#ModelBlobSupportTarget
 */
export interface ModelBlobSupport {

  /**
   * Upsert blob to storage
   * @param location The location of the blob
   * @param input The actual blob to write
   * @param meta Additional metadata to store with the blob
   * @param overwrite Should we replace content if already found, defaults to true
   */
  upsertBlob(location: string, input: BinaryInput, meta?: BlobMeta, overwrite?: boolean): Promise<void>;

  /**
   * Get blob from storage
   * @param location The location of the blob
   */
  getBlob(location: string, range?: ByteRange): Promise<Blob>;

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