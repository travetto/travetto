import { BeforeAll, AfterEach, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelSource, ModelRegistry } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';

import { ModelElasticsearchSource, ModelElasticsearchConfig } from '../';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelElasticsearchConfig): ModelSource {
    return new ModelElasticsearchSource(conf);
  }
}

export class BaseElasticsearchTest {

  @BeforeAll()
  async before() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    await ModelRegistry.init();
  }

  @AfterEach()
  @BeforeEach()
  async afterEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ModelElasticsearchSource;
    return await mms.resetDatabase();
  }
}