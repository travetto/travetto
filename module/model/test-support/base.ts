import { DependencyRegistry } from '@travetto/di';
import { Class, RootRegistry } from '@travetto/registry';
import { AfterEach, BeforeAll, BeforeEach } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { ModelRegistry } from '../src/registry/model';
import { isBulkSupported, isCrudSupported, isStorageSupported } from '../src/internal/service/common';
import { ModelType } from '../src/types/model';

let first = true;

export abstract class BaseModelSuite<T> {

  constructor(public serviceClass: Class<T>, public configClass: Class<any>) {
  }

  async saveAll<M extends ModelType>(cls: Class<M>, items: M[]) {
    const svc = await this.service;
    if (isBulkSupported(svc)) {
      const res = await svc.processBulk(cls, items.map(x => ({ insert: x })));
      return res.counts.insert;
    } else if (isCrudSupported(svc)) {
      const out = [] as Promise<M>[];
      for (const el of items) {
        out.push(svc.create(cls, el));
      }
      await Promise.all(out);
      return out.length;
    } else {
      throw new Error('Service does not support crud operations');
    }
  }

  wait(n: number) {
    return new Promise(res => setTimeout(res, n));
  }

  get service() {
    return DependencyRegistry.getInstance(this.serviceClass) as Promise<T>;
  }

  @BeforeAll()
  async init() {
    // Track self
    ResourceManager.addPath(__dirname);

    await RootRegistry.init();

    if (first) {
      const config = await DependencyRegistry.getInstance(this.configClass);
      if ('namespace' in config) {
        config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
      }
      first = false;
    }
  }

  @BeforeEach()
  async createStorage() {
    const service = await this.service;
    if (isStorageSupported(service)) {
      await service.createStorage();
      if (service.onModelVisibilityChange) {
        await Promise.all(ModelRegistry.getClasses().map(m =>
          service.onModelVisibilityChange!({ type: 'added', curr: m })));
      }
    }
  }

  @AfterEach()
  async deleteStorage() {
    const service = await this.service;
    if (isStorageSupported(service)) {
      if (service.onModelVisibilityChange) {
        await Promise.all(ModelRegistry.getClasses().map(m =>
          service.onModelVisibilityChange!({ type: 'removing', prev: m })));
      }
      await service.deleteStorage();
    }
  }
}