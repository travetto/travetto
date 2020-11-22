import { DependencyRegistry } from '@travetto/di';
import { Class, RootRegistry } from '@travetto/registry';

import { ModelCrudSupport } from '../..';
import { ModelRegistry } from '../../src/registry/registry';
import { isIndexedSupported, isStorageSupported } from '../../src/internal/service/common';
import { AfterEach, BeforeAll, BeforeEach } from '@travetto/test';
import { Model } from '../../src/registry/decorator';

export abstract class BaseModelSuite<T extends ModelCrudSupport> {

  constructor(public serviceClass: Class<T>, public configClass: Class<any>) {
  }

  wait(n: number) {
    return new Promise(res => setTimeout(res, n));
  }

  get service() {
    return DependencyRegistry.getInstance(this.serviceClass) as Promise<T>;
  }

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    const config = await DependencyRegistry.getInstance(this.configClass);
    if ('namespace' in config) {
      config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    }
  }

  @BeforeEach()
  async createStorage() {
    const service = await this.service;
    if (isStorageSupported(service)) {
      await service.createStorage();
      if (service.onModelVisiblityChange) {
        for (const cls of ModelRegistry.getClasses()) {
          await service.onModelVisiblityChange({ type: 'added', curr: cls });
        }
      }
    }
  }

  @AfterEach()
  async deleteStorage() {
    const service = await this.service;
    if (isStorageSupported(service)) {
      if (service.onModelVisiblityChange) {
        for (const cls of ModelRegistry.getClasses()) {
          await service.onModelVisiblityChange({ type: 'removing', prev: cls });
        }
      }
      await service.deleteStorage();
    }
  }
}