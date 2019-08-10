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

  async save(asset: Asset, upsert = true, strategy?: AssetNamingStrategy) {
    let res: Asset | undefined;

    // Apply strategy on save
    asset.path = (strategy || this.namingStrategy!).getPath(asset);

    try {
      res = await this.info(asset.path);
    } catch (e) {
      // Not found
    }

    if (res && !upsert) {
      throw new Error(`File already exists: ${asset.path}`);
    } else {
      return await this.source.write(asset, asset.stream);
    }
  }

  async get(filename: string, haveTags?: string[]): Promise<Asset> {
    const info = await this.info(filename);
    if (haveTags) {
      const fin = new Set(info.metadata.tags);
      for (const t of haveTags) {
        if (!fin.has(t)) {
          throw new AppError('Unable to find asset with specified tags', 'notfound');
        }
      }
    }

    info.stream = await this.source.read(filename);

    return info;
  }
}