import { BeforeAll, AfterEach, AfterAll } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelSource, ModelRegistry } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';

import { ElasticsearchModelSource, ElasticsearchModelConfig } from '../';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(conf);
  }
}

export class BaseElasticsearchTest {

  @BeforeAll()
  async before() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    const config = await DependencyRegistry.getInstance(ElasticsearchModelConfig);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    await ModelRegistry.init();

  }

  @AfterAll()
  @AfterEach()
  async afterEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ElasticsearchModelSource;
    await mms.client.indices.delete({
      index: mms.getNamespacedIndex('*')
    });
  }

  @AfterEach()
  async beforeEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ElasticsearchModelSource;
    await mms.postConstruct();
  }
}