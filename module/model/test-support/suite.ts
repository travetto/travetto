import { Class, ClassInstance, ResourceManager } from '@travetto/base';
import { PathUtil } from '@travetto/boot/src';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { SuiteRegistry } from '@travetto/test';

import { isStorageSupported } from '../src/internal/service/common';
import { ModelRegistry } from '../src/registry/model';

const Loaded = Symbol();

export function ModelSuite<T extends { configClass: Class, serviceClass: Class }>() {
  return (target: Class<T>) => {
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T) {
        // Track self
        ResourceManager.addPath(PathUtil.resolveUnix(__dirname, 'resources'));

        await RootRegistry.init();

        if (!(this as { [Loaded]?: boolean })[Loaded]) {
          const config = await DependencyRegistry.getInstance(this.configClass);
          if ('namespace' in config) {
            config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
          }
          (this as { [Loaded]?: boolean })[Loaded] = true;
        }
      },
      'beforeAll'
    );
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T) {
        const service = await DependencyRegistry.getInstance(this.serviceClass);
        if (isStorageSupported(service)) {
          await service.createStorage();
          if (service.createModel) {
            await Promise.all(ModelRegistry.getClasses()
              .filter(x => x === ModelRegistry.getBaseModel(x))
              .map(m => service.createModel!(m)));
          }
        }
      },
      'beforeEach'
    );
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T) {
        const service = await DependencyRegistry.getInstance(this.serviceClass);
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
      },
      'afterEach'
    );
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T) {
        const service = await DependencyRegistry.getInstance(this.serviceClass);
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
      },
      'afterAll'
    );

  };
}