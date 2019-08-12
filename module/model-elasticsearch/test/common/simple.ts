import { Suite, BeforeAll } from '@travetto/test';
import { BaseSimpleSourceSuite } from '@travetto/model/test/source/simple';

import { ElasticsearchModelSource } from '../../src/source';
import { ElasticsearchModelConfig } from '../../src/config';

@Suite('Simple Save')
class SimpleSuite extends BaseSimpleSourceSuite {

  configClass = ElasticsearchModelConfig;
  sourceClass = ElasticsearchModelSource;

  @BeforeAll() doInit() { return this.init(); }
}
