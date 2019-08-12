import { SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AfterEach, AfterAll } from '@travetto/test';

import { ModelRegistry } from '../src/registry';
import { ModelSource } from '../src/service/source';
import { ModelService } from '../src/service/model';

export abstract class BaseModelTest {

  abstract get configClass(): Class<{ namespace: string }>;
  abstract get sourceClass(): Class<ModelSource>;

  get service() {
    return DependencyRegistry.getInstance(ModelService);
  }

  get source() {
    return DependencyRegistry.getInstance(ModelSource);
  }

  async init() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    await ModelRegistry.init();
  }

  @AfterAll()
  async clear() {
    const mms = await this.source;
    await mms.clearDatabase();

  }

  @AfterEach()
  async reinit() {
    const mms = await this.source;
    await mms.clearDatabase();
    await mms.initDatabase();
  }
}