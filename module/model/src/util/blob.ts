import { Util } from '@travetto/runtime';
import { BlobMeta, BlobUtil, IOUtil } from '@travetto/io';
import { BlobInputLocation } from '../service/blob';

/**
 * Utilities for processing assets
 */
export class ModelBlobUtil {

  static getLocation(inp: BlobInputLocation, meta?: BlobMeta): string {
    return typeof inp === 'string' ? inp : inp(meta ?? {});
  }

  /**
   * Get a hashed location/path for a blob
   *
   * @param blob
   * @param prefix
   * @returns
   */
  static getHashedLocation(blob: Blob, prefix = ''): string {
    const meta = BlobUtil.getBlobMeta(blob) ?? {};

    let ext: string | undefined = '';

    if (meta.contentType) {
      ext = IOUtil.getExtension(meta.contentType);
    } else if (meta.filename) {
      const dot = meta.filename.indexOf('.');
      if (dot > 0) {
        ext = meta.filename.substring(dot + 1);
      }
    }

    ext = ext ? `.${ext.toLowerCase()}` : '';

    const hash = meta.hash ?? Util.uuid();

    return hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      `${prefix}${others.slice(0, 5).join('/')}${ext}`);
  }
}
