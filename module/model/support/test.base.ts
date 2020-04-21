import { DependencyRegistry } from '@travetto/di';
import { Class, RootRegistry } from '@travetto/registry';
import { AfterEach, BeforeEach } from '@travetto/test';

import { ModelSource } from '../src/service/source';
import { ModelService } from '../src/service/model';
import '../src/registry'; // Import registry to declare

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
    await RootRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
  }

  @BeforeEach()
  async initDb() {
    const mms = await this.source;
    await mms.initDatabase();
  }

  @AfterEach()
  async reinit() {
    const mms = await this.source;
    await mms.clearDatabase();
  }
}