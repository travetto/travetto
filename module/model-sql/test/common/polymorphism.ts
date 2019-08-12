import { BasePolymorphismSuite } from '@travetto/model/test/source/polymorphism';
import { Suite, BeforeAll } from '@travetto/test';

import { SQLModelConfig } from '../../src/config';
import { TestUtil } from '../util';
import { SQLModelSource } from '../../src/source';

@Suite('Polymorphism')
class TestPolymorphism extends BasePolymorphismSuite {

  configClass = SQLModelConfig;
  sourceClass = SQLModelSource;

  @BeforeAll()
  doInit() {
    return TestUtil.init(this);
  }
}
