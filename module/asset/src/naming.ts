import * as mime from 'mime';

import { Asset } from './types';

/**
 * Standard class for an asset naming strateigy
 */
export abstract class AssetNamingStrategy {
  public readonly prefix: string;
  /**
   * Produce a path for a given asset
   * @param Asset Get path from an asset
   */
  abstract getPath(Asset: Asset): string;
}

/**
 * Straight forward, retains name with optional prefix
 */
export class SimpleNamingStrategy implements AssetNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  getPath(asset: Asset) {
    return `${this.prefix}${asset.path}`;
  }
}

/**
 * Derives asset name via the hash value, to prevent
 * file duplication
 */
export class HashNamingStrategy implements AssetNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  getPath(asset: Asset) {
    let ext = '';

    if (asset.contentType) {
      ext = mime.getExtension(asset.contentType)!;
    } else {
      const dot = asset.path.indexOf('.');
      if (dot > 0) {
        ext = asset.path.substring(dot + 1);
      }
    }

    ext = ext ? `.${ext.toLowerCase()}` : '';

    return asset.metadata.hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      `${this.prefix}${others.slice(0, 5).join('/')}${ext}`);
  }
}
