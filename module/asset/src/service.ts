import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';

import { Asset } from './types';
import { AssetSource } from './source';
import { AssetNamingStrategy, SimpleNamingStrategy } from './strategy';

@Injectable()
export class AssetService {

  constructor(
    private source: AssetSource,
    private namingStrategy?: AssetNamingStrategy) {
    if (!namingStrategy) {
      this.namingStrategy = new SimpleNamingStrategy();
    }
  }

  remove(path: string) {
    return this.source.remove(path);
  }

  info(file: string) {
    return this.source.info(file);
  }

  async save(asset: Asset, upsert = true, strategy?: AssetNamingStrategy): Promise<string> {

    // Apply strategy on save
    asset.path = (strategy ?? this.namingStrategy!).getPath(asset);

    if (!upsert) {
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

  async get(path: string, haveTags?: string[]): Promise<Asset> {
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