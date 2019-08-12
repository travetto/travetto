import { Suite, BeforeAll } from '@travetto/test';
import { BaseSimpleSourceSuite } from '@travetto/model/test/source/simple';

import { MongoModelSource } from '../..';
import { MongoModelConfig } from '../../src/config';

@Suite('Simple Save')
class SimpleSuite extends BaseSimpleSourceSuite {

  configClass = MongoModelConfig;
  sourceClass = MongoModelSource;

  @BeforeAll() init() { return super.init(); }
}