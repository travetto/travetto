import * as assert from 'assert';
import * as fs from 'fs';
import * as util from 'util';

import { AssetService, AssetUtil, AssetSource } from '@travetto/asset';
import { Suite, BeforeAll, BeforeEach, Test } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { S3AssetSource } from '../src/source';
import { S3AssetConfig } from '../src/config';

const fsStat = util.promisify(fs.stat);

class Config extends S3AssetConfig {
  @InjectableFactory()
  static getConf(): S3AssetConfig {
    return new S3AssetConfig();
  }
  @InjectableFactory()
  static getSource(cfg: S3AssetConfig): AssetSource {
    return new S3AssetSource(cfg);
  }
}

@Suite()
class TestAssetService {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

}