import { Class } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { RegistryV2 } from '@travetto/registry';
import { SuiteRegistry, TestFixtures } from '@travetto/test';

import { ModelBlobUtil } from '../../src/util/blob.ts';
import { ModelStorageUtil } from '../../src/util/storage.ts';
import { ModelRegistryIndex } from '../../src/registry/registry-index.ts';

const Loaded = Symbol();

export function ModelSuite<T extends { configClass: Class<{ autoCreate?: boolean, namespace?: string }>, serviceClass: Class }>(qualifier?: symbol) {
  const fixtures = new TestFixtures(['@travetto/model']);
  return (target: Class<T>): void => {
    target.prototype.fixtures = fixtures;

    SuiteRegistry.registerPendingListener(
      target,
      async function (this: T & { [Loaded]?: boolean }) {
        await RegistryV2.init();

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
        if (ModelStorageUtil.isSupported(service)) {
          await service.createStorage();
          if (service.createModel) {
            await Promise.all(ModelRegistryIndex.getClasses()
              .filter(x => x === ModelRegistryIndex.getBaseModel(x))
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
        if (ModelStorageUtil.isSupported(service)) {
          const models = ModelRegistryIndex.getClasses().filter(m => m === ModelRegistryIndex.getBaseModel(m));

          if (ModelBlobUtil.isSupported(service) && service.truncateBlob) {
            await service.truncateBlob();
          }

          if (service.truncateModel) {
            await Promise.all(models.map(x => service.truncateModel!(x)));
          } else if (service.deleteModel) {
            await Promise.all(models.map(x => service.deleteModel!(x)));
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
        if (ModelStorageUtil.isSupported(service)) {
          if (service.deleteModel) {
            for (const m of ModelRegistryIndex.getClasses()) {
              if (m === ModelRegistryIndex.getBaseModel(m)) {
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