import * as mime from 'mime';

import { Asset } from './types';

export abstract class AssetNamingStrategy {
  public readonly prefix: string;
  abstract getPath(Asset: Asset): string;
}

export class SimpleNamingStrategy implements AssetNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  getPath(asset: Asset) {
    return `${this.prefix}${asset.path}`;
  }
}

export class HashNamingStrategy implements AssetNamingStrategy {
  constructor(public readonly prefix: string = '') { }

  getPath(asset: Asset) {
    let ext = '';

    if (asset.contentType) {
      ext = mime.getExtension(asset.contentType)!;
    } else if (asset.path.indexOf('.') > 0) {
      ext = asset.path.split('.').pop()!;
    }

    ext = ext ? `.${ext.toLowerCase()}` : '';

    return asset.metadata.hash.replace(/(.{4})(.{4})(.{4})(.{4})(.+)/, (all, ...others) =>
      `${this.prefix}${others.slice(0, 5).join('/')}${ext}`);
  }
}
