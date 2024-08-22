import { BlobMeta, Util } from '@travetto/runtime';
import { BlobUtil } from '@travetto/io';

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Get a hashed location/path for a blob
   */
  static getHashedLocation(meta: BlobMeta, prefix = ''): string {
    const hash = meta.hash ?? Util.uuid();

    const base = hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (_, ...others) =>
      `${prefix}${others.slice(0, 5).join('/')}`);

    return BlobUtil.getFilename(base, meta);
  }
}
