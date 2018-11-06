import { BeforeAll, AfterEach, BeforeEach } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { ModelSource, ModelRegistry } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';

import { ModelSqlSource, ModelSqlConfig } from '../';

export class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelSqlConfig): ModelSource {
    return new ModelSqlSource(conf);
  }
}

export class BaseSqlTest {

  @BeforeAll()
  async before() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    await ModelRegistry.init();
  }

  @AfterEach()
  @BeforeEach()
  async afterEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as ModelSqlSource;
    return await mms.resetDatabase();
  }
}