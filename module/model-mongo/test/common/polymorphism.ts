import { BasePolymorphismSuite } from '@travetto/model/test/source/polymorphism';
import { Suite, BeforeAll } from '@travetto/test';

import { MongoModelConfig } from '../../src/config';
import { MongoModelSource } from '../../src/source';

@Suite('Polymorphism')
class TestPolymorphism extends BasePolymorphismSuite {

  configClass = MongoModelConfig;
  sourceClass = MongoModelSource;

  @BeforeAll()
  doInit() {
    return this.init();
  }
}
