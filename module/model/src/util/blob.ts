import { Util } from '@travetto/runtime';
import { BlobMeta, BlobUtil } from '@travetto/io';
import { BlobInputLocation } from '../service/blob';

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  /**
   * Get location
   */
  static getLocation(inp: BlobInputLocation, meta?: BlobMeta): string {
    return typeof inp === 'string' ? inp : inp(meta ?? {});
  }

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
