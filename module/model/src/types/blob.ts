import type { BinarySource, BlobMeta, ByteRange, TimeSpan } from '@travetto/runtime';

/**
 * Support for Blobs CRUD.
 *
 * @concrete
 */
export interface ModelBlobSupport {

  /**
   * Upsert blob to storage
   * @param location The location of the blob
   * @param input The actual blob to write
   * @param meta Additional metadata to store with the blob
   * @param overwrite Should we replace content if already found, defaults to true
   */
  upsertBlob(location: string, input: BinarySource, meta?: BlobMeta, overwrite?: boolean): Promise<void>;

  /**
   * Get blob from storage
   * @param location The location of the blob
   */
  getBlob(location: string, range?: ByteRange): Promise<Blob>;

  /**
   * Get metadata for blob
   * @param location The location of the blob
   */
  getBlobMeta(location: string): Promise<BlobMeta>;

  /**
   * Delete blob by location
   * @param location The location of the blob
   */
  deleteBlob(location: string): Promise<void>;

  /**
   * Update blob metadata
   * @param location The location of the blob
   */
  updateBlobMeta(location: string, meta: BlobMeta): Promise<void>;

  /**
   * Produces an externally usable URL for sharing limited read access to a specific resource
   *
   * @param location The asset location to read from
   * @param exp Expiry
   */
  getBlobReadUrl?(location: string, exp?: TimeSpan): Promise<string>;

  /**
   * Produces an externally usable URL for sharing allowing direct write access
   *
   * @param location The asset location to write to
   * @param meta The metadata to associate with the final asset
   * @param exp Expiry
   */
  getBlobWriteUrl?(location: string, meta: BlobMeta, exp?: TimeSpan): Promise<string>;
}