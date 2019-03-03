import { BeforeAll, BeforeEach, AfterEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelSource } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';

import { MongoModelSource, ModelMongoConfig } from '../';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelMongoConfig): ModelSource {
    return new MongoModelSource(conf);
  }
}

export class BaseMongoTest {

  @BeforeAll()
  async before() {
    await DependencyRegistry.init();
    await SchemaRegistry.init();
  }

  @BeforeEach()
  async beforeEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as MongoModelSource;
    await mms.init();
  }

  @AfterEach()
  async afterEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as MongoModelSource;
    await (mms as any).db.dropDatabase();
  }
}