import { Class, ResourceManager } from '@travetto/base';
import { PathUtil } from '@travetto/boot';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { SuiteRegistry } from '@travetto/test';

import { isStorageSupported, isStreamSupported } from '../src/internal/service/common';
import { StreamModel } from '../src/internal/service/stream';
import { ModelRegistry } from '../src/registry/model';

const Loaded = Symbol();

export function ModelSuite<T extends { configClass: Class<{ autoCreate?: boolean, namespace?: string }>, serviceClass: Class }>(qualifier?: symbol) {
  return (target: Class<T>): void => {
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T & { [Loaded]?: boolean }) {
        // Track self
        ResourceManager.addPath(PathUtil.resolveUnix(__dirname, 'resources'));

        await RootRegistry.init();

        if (!this[Loaded]) {
          const config = await DependencyRegistry.getInstance(this.configClass);
          if ('namespace' in config) {
            config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
          }
          // We manually create
          config.autoCreate = false;
          this[Loaded] = true;
        }
      },
      'beforeAll'
    );
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T) {
        const service = await DependencyRegistry.getInstance(this.serviceClass, qualifier);
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
        const service = await DependencyRegistry.getInstance(this.serviceClass, qualifier);
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
            if (isStreamSupported(service)) {
              if (service.truncateModel) {
                await service.truncateModel(StreamModel);
              } else if (service.deleteModel) {
                await service.deleteModel(StreamModel);
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
        const service = await DependencyRegistry.getInstance(this.serviceClass, qualifier);
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