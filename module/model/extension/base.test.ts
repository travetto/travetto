import { SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';

import { ModelRegistry } from '../src/registry';
import { ModelSource } from '../src/service/source';

export abstract class BaseModelTest {

  abstract get configClass(): Class<{ namespace: string }>;

  async init() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    await ModelRegistry.init();
  }

  async clear() {
    const mms = (await DependencyRegistry.getInstance(ModelSource));
    await mms.clearDatabase();

  }

  async reinit() {
    const mms = (await DependencyRegistry.getInstance(ModelSource));
    await mms.clearDatabase();
    await mms.initDatabase();
  }
}