import { BinaryInput, BlobMeta, ByteRange } from '@travetto/runtime';


export const ModelBlobNamespace = '__blobs';


/**
 * Support for Blobs CRD.  Blob update is not supported.
 *
 * @concrete ../internal/service/common#ModelBlobSupportTarget
 */
export interface ModelBlobSupport {

  /**
   * Insert blob to storage
   * @param location The location of the blob
   * @param input The actual blob to write
   */
  insertBlob(location: string, input: BinaryInput, meta?: BlobMeta, errorIfExisting?: boolean): Promise<void>;

  /**
   * Upsert blob to storage
   * @param location The location of the blob
   * @param input The actual blob to write
   */
  upsertBlob(location: string, input: BinaryInput, meta?: BlobMeta): Promise<void>;

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