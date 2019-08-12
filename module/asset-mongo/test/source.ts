import { Suite, BeforeEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { BaseAssetSourceSuite } from '@travetto/asset/test/source';

import { MongoAssetSource } from '../src/source';

@Suite()
class AssetSourceSuite extends BaseAssetSourceSuite {

  @BeforeEach()
  async resetDb() {
    const source = await DependencyRegistry.getInstance(MongoAssetSource);
    await source['mongoClient'].db().dropDatabase();
  }
}