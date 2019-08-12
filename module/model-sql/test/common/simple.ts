import { Suite, BeforeAll } from '@travetto/test';
import { BaseSimpleSourceSuite } from '@travetto/model/test/source/simple';

import { SQLModelSource } from '../..';
import { SQLModelConfig } from '../../src/config';

import { TestUtil } from '../util';

@Suite('Simple Save')
class SimpleSuite extends BaseSimpleSourceSuite {

  configClass = SQLModelConfig;
  sourceClass = SQLModelSource;

  @BeforeAll()
  doInit() {
    return TestUtil.init(this);
  }
}