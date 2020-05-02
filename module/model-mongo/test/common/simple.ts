import { Suite, BeforeAll } from '@travetto/test';
import { BaseSimpleSourceSuite } from '@travetto/model/test/lib/source/simple';

import { MongoModelSource } from '../..';
import { MongoModelConfig } from '../../src/config';

@Suite('Simple Save')
class SimpleSuite extends BaseSimpleSourceSuite {

  configClass = MongoModelConfig;
  sourceClass = MongoModelSource;

  @BeforeAll()
  async doInit() {
    return this.init();
  }
}