import { BaseNestedSuite } from '@travetto/model/test/source/nested';
import { Suite, BeforeAll } from '@travetto/test';
import { MongoModelConfig } from '../../src/config';
import { MongoModelSource } from '../../src/source';

@Suite()
export class NestedSuite extends BaseNestedSuite {

  configClass = MongoModelConfig;
  sourceClass = MongoModelSource;

  @BeforeAll()
  doInit() {
    return this.init();
  }
}