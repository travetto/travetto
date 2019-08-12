import { BaseNestedSuite } from '@travetto/model/test/source/nested';
import { Suite, BeforeAll } from '@travetto/test';
import { SQLModelConfig } from '../../src/config';
import { TestUtil } from '../util';
import { SQLModelSource } from '../../src/source';

@Suite()
export class NestedSuite extends BaseNestedSuite {

  configClass = SQLModelConfig;
  sourceClass = SQLModelSource;

  @BeforeAll()
  doInit() {
    return TestUtil.init(this);
  }
}