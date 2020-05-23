import { Suite, BeforeEach } from '@travetto/test';
import { Injectable } from '@travetto/di';

import { BaseAssetSourceSuite } from './lib/source';
import { AssetSource } from '../src/source';
import { Asset } from '../src/types';

@Injectable()
class Config { }

@Injectable()
class MemorySource extends AssetSource {
  data = new Map<string, Asset>();

  async write(asset: Asset) {
    this.data.set(asset.path, asset);
  }

  async read(key: string) {
    if (this.data.has(key)) {
      return this.data.get(key)!.stream;
    } else {
      throw new Error('Not found');
    }
  }

  async info(key: string) {
    if (this.data.has(key)) {
      return this.data.get(key)!;
    } else {
      throw new Error('Not found');
    }
  }

  async delete(key: string) {
    if (this.data.has(key)) {
      this.data.delete(key);
    } else {
      throw new Error('Not found');
    }
  }
}

@Suite()
export class AssetSourceTest extends BaseAssetSourceSuite {

  sourceClass = MemorySource;
  configClass = Config;

  @BeforeEach()
  async resetDb() {
    (await this.source as MemorySource).data.clear();
  }
}