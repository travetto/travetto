import { Suite, BeforeEach } from '@travetto/test';
import { BaseAssetSourceSuite } from '@travetto/asset/test/source';

import { MongoAssetSource } from '../src/source';

@Suite()
class AssetSourceSuite extends BaseAssetSourceSuite {

  sourceClass = MongoAssetSource;

  @BeforeEach()
  async resetDb() {
    const source = await this.source as MongoAssetSource;
    await source['mongoClient'].db().dropDatabase();
  }
}