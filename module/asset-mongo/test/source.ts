import { Suite, BeforeEach } from '@travetto/test';
import { BaseAssetSourceSuite } from '@travetto/asset/test/lib/source';

import { MongoAssetSource } from '../src/source';
import { MongoAssetConfig } from '../src/config';

@Suite()
class AssetSourceSuite extends BaseAssetSourceSuite {

  sourceClass = MongoAssetSource;
  configClass = MongoAssetConfig;

  @BeforeEach()
  async resetDb() {
    const source = await this.source as MongoAssetSource;
    await source['mongoClient'].db().dropDatabase();
  }
}