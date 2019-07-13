import { BeforeAll, AfterEach, AfterAll } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelSource } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';

import { MongoModelSource, MongoModelConfig } from '../';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: MongoModelConfig): ModelSource {
    return new MongoModelSource(conf);
  }
}

export class BaseMongoTest {

  @BeforeAll()
  async before() {
    await DependencyRegistry.init();
    await SchemaRegistry.init();
    const config = await DependencyRegistry.getInstance(MongoModelConfig);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
  }

  @AfterAll()
  @AfterEach()
  async clean() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as MongoModelSource;
    await (mms as any).db.dropDatabase();
  }

  @AfterEach()
  async reset() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as MongoModelSource;
    await mms.postConstruct();
  }
}