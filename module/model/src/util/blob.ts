import { Readable, PassThrough } from 'node:stream';

import { BlobMeta, Util } from '@travetto/runtime';
import { BlobUtil } from '@travetto/io';

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

  /**
   * Get a stream as a lazy value
   * @param src
   * @returns
   */
  static getLazyStream(src: () => (Promise<Readable> | Readable)): () => Readable {
    const out = new PassThrough();
    const run = (): void => { Promise.resolve(src()).then(v => v.pipe(out), (err) => out.destroy(err)); };
    return () => (run(), out);
  }

  /**
   * Convert input to a blob, backed by lazy stream, will not hash or attempt to detect content type
   */
  static async lazyStreamBlob(src: (() => (Readable | Promise<Readable>)), metadata: BlobMeta = {}): Promise<Blob> {
    const input = this.getLazyStream(src);
    return await Util.toBlob(input, metadata);
  }
}
