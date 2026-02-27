import { describeFunction, type Class } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex, TestFixtures } from '@travetto/test';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ModelBlobUtil } from '../../src/util/blob.ts';
import { ModelStorageUtil } from '../../src/util/storage.ts';
import { ModelRegistryIndex } from '../../src/registry/registry-index.ts';

const Loaded = Symbol();

/**
 * Model test suite decorator
 * @augments `@travetto/schema:Schema`
 * @example opt-in
 * @kind decorator
 */
export function ModelSuite<T extends { configClass: Class<{ autoCreate?: boolean, namespace?: string }>, serviceClass: Class }>(qualifier?: symbol) {
  const fixtures = new TestFixtures(['@travetto/model']);
  return (target: Class<T>): void => {
    target.prototype.fixtures = fixtures;
    SuiteRegistryIndex.getForRegister(target).register({
      phaseHandlers: [{
        type: 'beforeAll',
        import: describeFunction(ModelSuite).import,
        async action(this: T & { [Loaded]?: boolean }) {
          await Registry.init();

          if (!this[Loaded]) {
            const config = await DependencyRegistryIndex.getInstance(this.configClass);
            if ('namespace' in config) {
              config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
            }
            // We manually create
            config.autoCreate = false;
            this[Loaded] = true;
          }
        }
      },
      {
        type: 'beforeEach',
        import: describeFunction(ModelSuite).import,
        async action(this: T) {
          const service = await DependencyRegistryIndex.getInstance(this.serviceClass, qualifier);
          if (ModelStorageUtil.isSupported(service)) {
            await service.createStorage();
            if (service.upsertModel) {
              await Promise.all(ModelRegistryIndex.getClasses()
                .filter(x => x === SchemaRegistryIndex.getBaseClass(x))
                .map(m => service.upsertModel!(m)));
            }
          }
        }
      },
      {
        type: 'afterEach',
        import: describeFunction(ModelSuite).import,
        async action(this: T) {
          const service = await DependencyRegistryIndex.getInstance(this.serviceClass, qualifier);
          if (ModelStorageUtil.isSupported(service)) {
            const models = ModelRegistryIndex.getClasses().filter(m => m === SchemaRegistryIndex.getBaseClass(m));

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
        }
      },
      {
        type: 'afterAll',
        import: describeFunction(ModelSuite).import,
        async action(this: T) {
          const service = await DependencyRegistryIndex.getInstance(this.serviceClass, qualifier);
          if (ModelStorageUtil.isSupported(service)) {
            if (service.deleteModel) {
              for (const m of ModelRegistryIndex.getClasses()) {
                if (m === SchemaRegistryIndex.getBaseClass(m)) {
                  await service.deleteModel(m);
                }
              }
            }
            await service.deleteStorage();
          }
        }
      }]
    });
  };
}