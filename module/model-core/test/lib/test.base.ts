import { DependencyRegistry } from '@travetto/di';
import { Class, RootRegistry } from '@travetto/registry';

import { ModelCrudSupport } from '../..';
import { isStorageSupported } from '../../src/service/internal';

export abstract class BaseModelSuite<T extends ModelCrudSupport> {

  constructor(public serviceClass: Class<T>, public configClass: Class<any>) {
  }

  get service() {
    return DependencyRegistry.getInstance(this.serviceClass) as Promise<T>;
  }

  async init() {
    await RootRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
    if ('namespace' in config) {
      config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    }
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