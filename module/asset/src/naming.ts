import * as mime from 'mime';

import { Asset } from './types';

/**
 * Standard class for an asset naming strateigy
 */
export abstract class AssetNamingStrategy {
  readonly prefix: string;

  /**
   * Produce a path for a given asset
   * @param asset Get path from an asset
   */
  abstract resolve(asset: Asset): string;
}

/**
 * Straight forward, retains name with optional prefix
 */
export class SimpleNamingStrategy implements AssetNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  resolve(asset: Asset) {
    return `${this.prefix}${asset.filename}`;
  }
}

/**
 * Derives asset name via the hash value, to prevent
 * file duplication
 */
export class HashNamingStrategy implements AssetNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  resolve(asset: Asset) {
    let ext = '';

    if (asset.contentType) {
      ext = mime.getExtension(asset.contentType)!;
    } else if (asset.filename) {
      const dot = asset.filename.indexOf('.');
      if (dot > 0) {
        ext = asset.filename.substring(dot + 1);
      }
    }

    ext = ext ? `.${ext.toLowerCase()}` : '';

    return asset.hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      `${this.prefix}${others.slice(0, 5).join('/')}${ext}`);
  }
}
