import { Util } from '@travetto/runtime';

import { ModelBlobMeta } from './types';
import { ModelBlobUtil } from './util';

/**
 * Standard class for an blob naming strategy
 * @concrete ./internal/types#ModelBlobNamingStrategyImpl
 */
export interface ModelBlobNamingStrategy {
  readonly prefix: string;

  /**
   * Produce a path for a given blob meta
   * @param meta Get path from blob meta
   */
  resolve(meta: ModelBlobMeta): string;
}

/**
 * Straight forward, retains name with optional prefix
 */
export class SimpleNamingStrategy implements ModelBlobNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  resolve(meta: ModelBlobMeta): string {
    return `${this.prefix}${meta.filename}`;
  }
}

/**
 * Derives blob name via the hash value, to prevent
 * file duplication
 */
export class HashNamingStrategy implements ModelBlobNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  resolve(meta: ModelBlobMeta): string {
    let ext: string | undefined = '';

    if (meta.contentType) {
      ext = ModelBlobUtil.getExtension(meta.contentType);
    } else if (meta.filename) {
      const dot = meta.filename.indexOf('.');
      if (dot > 0) {
        ext = meta.filename.substring(dot + 1);
      }
    }

    ext = ext ? `.${ext.toLowerCase()}` : '';

    const hash = meta.hash ?? Util.uuid();

    return hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      `${this.prefix}${others.slice(0, 5).join('/')}${ext}`);
  }
}
