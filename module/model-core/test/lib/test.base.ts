import { DependencyRegistry } from '@travetto/di';
import { Class, RootRegistry } from '@travetto/registry';

import { ModelCrudSupport } from '../..';
import { isStorageSupported } from '../../src/service/internal';

export abstract class BaseModelTest<T extends ModelCrudSupport = ModelCrudSupport> {

  constructor(public serviceClass: Class<T>, public configClass: Class<{ namespace: string }>) {
  }

  get service() {
    return DependencyRegistry.getInstance(this.serviceClass) as Promise<T>;
  }

  async init() {
    await RootRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
  }

  async initDb() {
    const mms = await this.service;
    if (isStorageSupported(mms)) {
      await mms.createStorage();
    }
  }

  async cleanup() {
    const mms = await this.service;
    if (isStorageSupported(mms)) {
      await mms.deleteStorage();
    }
  }
}