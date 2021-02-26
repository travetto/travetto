import { FsUtil } from '@travetto/boot';
import { DependencyRegistry } from '@travetto/di';
import { AfterAll, AfterEach, BeforeAll, BeforeEach } from '@travetto/test';
import { Class, ResourceManager } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { TimeUnit, TimeUtil } from '@travetto/base/src/internal/time';
import { BaseInjectableTest } from '@travetto/di/test-support/base';

import { ModelRegistry } from '../src/registry/model';
import { isBulkSupported, isCrudSupported, isStorageSupported } from '../src/internal/service/common';
import { ModelType } from '../src/types/model';

let first = true;

export abstract class BaseModelSuite<T> extends BaseInjectableTest {

  constructor(public serviceClass: Class<T>, public configClass: Class) {
    super();
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

  wait(n: number, unit: TimeUnit = 'ms') {
    return new Promise(res => setTimeout(res, TimeUtil.toMillis(n, unit)));
  }

  get service() {
    return DependencyRegistry.getInstance(this.serviceClass) as Promise<T>;
  }

  @BeforeAll()
  async init() {
    // Track self
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, 'resources'));

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
      if (service.createModel) {
        await Promise.all(ModelRegistry.getClasses()
          .filter(x => x === ModelRegistry.getBaseModel(x))
          .map(m => service.createModel!(m)));
      }
    }
  }

  @AfterEach()
  async deleteStorage() {
    const service = await this.service;
    if (isStorageSupported(service)) {
      if (service.truncateModel || service.deleteModel) {
        for (const m of ModelRegistry.getClasses()) {
          if (m === ModelRegistry.getBaseModel(m)) {
            if (service.truncateModel) {
              await service.truncateModel(m);
            } else if (service.deleteModel) {
              await service.deleteModel(m);
            }
          }
        }
      } else {
        await service.deleteStorage(); // Purge it all
      }
    }
  }

  @AfterAll()
  async deleteAllStorage() {
    const service = await this.service;
    if (isStorageSupported(service)) {
      if (service.deleteModel) {
        for (const m of ModelRegistry.getClasses()) {
          if (m === ModelRegistry.getBaseModel(m)) {
            await service.deleteModel(m);
          }
        }
      }
      await service.deleteStorage();
    }
  }
}