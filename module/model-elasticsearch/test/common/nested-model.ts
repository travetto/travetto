import { Suite, BeforeAll } from '@travetto/test';
import { BaseNestedSuite } from '@travetto/model/test/source/nested';
import { ElasticsearchModelConfig } from '../../src/config';
import { ElasticsearchModelSource } from '../../src/source';

@Suite()
export class NestedSuite extends BaseNestedSuite {
  configClass = ElasticsearchModelConfig;
  sourceClass = ElasticsearchModelSource;

  @BeforeAll()
  doInit() {
    return super.init();
  }
}