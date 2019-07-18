import { BeforeAll, AfterEach, AfterAll } from '@travetto/test';
import { BaseModelTest } from '@travetto/model/extension/base.test';

import { ElasticsearchModelConfig } from '../';

export class BaseElasticsearchTest extends BaseModelTest {
  configClass = ElasticsearchModelConfig;

  @BeforeAll() doInit() { return this.init(); }
  @AfterEach() doReinit() { return this.reinit(); }
  @AfterAll() doClear() { return this.clear(); }
}