import { Suite, BeforeAll } from '@travetto/test';
import { BaseGeoTestSuite } from '@travetto/model/test/source/geo';

import { MongoModelConfig } from '../../src/config';
import { MongoModelSource } from '../../src/source';

@Suite()
export class GeoTestSuite extends BaseGeoTestSuite {
  configClass = MongoModelConfig;
  sourceClass = MongoModelSource;

  @BeforeAll()
  doInit() {
    return this.init();
  }
}