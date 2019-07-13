import { BeforeAll, AfterEach, AfterAll } from '@travetto/test';
import { BaseModelTest } from '@travetto/model/extension/base.test';

import { MongoModelConfig } from '../';

export class BaseMongoTest extends BaseModelTest {
  configClass = MongoModelConfig;
  @BeforeAll() init() { return super.init(); }
  @AfterEach() reinit() { return super.reinit(); }
  @AfterAll() clear() { return super.clear(); }
}