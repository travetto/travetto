import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';

import { Asset } from './types';
import { AssetSource } from './source';
import { AssetNamingStrategy, SimpleNamingStrategy } from './naming';

/**
 * Services asset CRUD operations.  Takes in a source is defined elsewhere.
 * Additionally supports a naming strategy that allows for translation of names
 * to and from the asset source.
 */
@Injectable()
export class AssetService {

  constructor(
    private source: AssetSource,
    private namingStrategy?: AssetNamingStrategy) {
    if (!namingStrategy) {
      this.namingStrategy = new SimpleNamingStrategy();
    }
  }

  delete(path: string) {
    return this.source.delete(path);
  }

  info(file: string) {
    return this.source.info(file);
  }
  /**
   * Stores an asset with the optional ability to overwrite if the file is already found. If not
   * overwriting and file exists, an error will be thrown.
   */
  async write(asset: Asset, overwriteIfFound = true, strategy?: AssetNamingStrategy): Promise<string> {

    // Apply strategy on save
    asset.path = (strategy ?? this.namingStrategy!).getPath(asset);

    if (!overwriteIfFound) {
      let missing = false;
      try {
        await this.info(asset.path);
      } catch  {
        missing = true;
      }
      if (!missing) {
        throw new AppError(`File already exists: ${asset.path}`, 'data');
      }
    }

    await this.source.write(asset, asset.stream);
    return asset.path;
  }

  /**
   * Retrieve a file from the store, with the ability to ensure certain tags
   * are set on the asset.  This can be used as a rudimentary ACL to ensure
   * cross account assets aren't shared.
   */
  async read(path: string, haveTags?: string[]): Promise<Asset> {
    const info = await this.info(path);
    if (haveTags) {
      const fin = new Set(info.metadata.tags);
      for (const t of haveTags) {
        if (!fin.has(t)) {
          throw new AppError('Unable to find asset with specified tags', 'notfound');
        }
      }
    }

    info.stream = await this.source.read(path);

    return info;
  }
}