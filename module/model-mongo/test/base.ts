import { BeforeAll, AfterAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelMongoSource, ModelMongoConfig } from '../src/service';
import { ModelSource } from '@travetto/model';
import { RootRegistry } from '@travetto/registry';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(conf);
  }
}

export class BaseMongoTest {

  @BeforeAll()
  async before() {
    await RootRegistry.init();
  }

  @BeforeEach()
  async beforeEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ModelMongoSource;
    return await mms.resetDatabase();
  }
}