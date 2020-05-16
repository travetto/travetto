import { BaseNestedSuite } from '@travetto/model/test/lib/source/nested';
import { BeforeAll } from '@travetto/test';
import { SQLModelConfig } from '../../src/config';
import { TestUtil } from '../lib/util';
import { SQLModelSource } from '../../src/source';
import { DialectSuite as Suite } from '../decorator';

@Suite()
abstract class NestedSuite extends BaseNestedSuite {

  configClass = SQLModelConfig;
  sourceClass = SQLModelSource;

  @BeforeAll()
  doInit() {
    return TestUtil.initModel(this);
  }
}