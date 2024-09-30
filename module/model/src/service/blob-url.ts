import { BlobMeta, TimeSpan } from '@travetto/runtime';

/**
 * Support for Blob URL Read/Write
 *
 * @concrete ../internal/service/common#ModelBlobUrlSupportTarget
 */
export interface ModelBlobUrlSupport {
  /**
   * Produces an externally usable URL for sharing limited read access to a specific resource
   *
   * @param location The asset location to read from
   * @param exp Expiry
   */
  getBlobReadUrl(location: string, exp?: TimeSpan): Promise<string>;

  /**
   * Produces an externally usable URL for sharing allowing direct write access
   *
   * @param location The asset location to write to
   * @param meta The metadata to associate with the final asset
   * @param exp Expiry
   */
  getBlobWriteUrl(location: string, meta: BlobMeta, exp?: TimeSpan): Promise<string>;
}