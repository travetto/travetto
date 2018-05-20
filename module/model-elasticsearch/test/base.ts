import { BeforeAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelSource } from '@travetto/model';
import { RootRegistry } from '@travetto/registry';

import { ModelElasticsearchSource, ModelElasticsearchConfig } from '../src/service';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelElasticsearchConfig): ModelSource {
    return new ModelElasticsearchSource(conf);
  }
}

export class BaseElasticsearchTest {

  @BeforeAll()
  async before() {
    await RootRegistry.init();
  }

  @BeforeEach()
  async beforeEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ModelElasticsearchSource;
    return await mms.resetDatabase();
  }
}