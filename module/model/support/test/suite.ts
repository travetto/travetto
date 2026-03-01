import { type Class } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex, TestFixtures, type SuitePhaseHandler } from '@travetto/test';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ModelBlobUtil } from '../../src/util/blob.ts';
import { ModelStorageUtil } from '../../src/util/storage.ts';
import { ModelRegistryIndex } from '../../src/registry/registry-index.ts';

type ConfigType = { autoCreate?: boolean, namespace?: string };

class ModelSuiteHandler<T extends { configClass: Class<ConfigType>, serviceClass: Class }> implements SuitePhaseHandler {
  qualifier?: symbol;
  target: Class<T>;
  constructor(target: Class<T>, qualifier?: symbol) {
    this.qualifier = qualifier;
    this.target = target;
  }

  async beforeAll(instance: T) {
    await Registry.init();

    const config = await DependencyRegistryIndex.getInstance<ConfigType>(instance.configClass);
    if ('namespace' in config) {
      config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    }

    // We manually create
    config.autoCreate = false;
  }

  async beforeEach(instance: T) {
    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
    if (ModelStorageUtil.isSupported(service)) {
      await service.createStorage();
      if (service.upsertModel) {
        await Promise.all(ModelRegistryIndex.getClasses()
          .filter(cls => cls === SchemaRegistryIndex.getBaseClass(cls))
          .map(modelCls => service.upsertModel!(modelCls)));
      }
    }
  }

  async afterEach(instance: T) {
    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
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

  async afterAll(instance: T) {
    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
    if (ModelStorageUtil.isSupported(service)) {
      if (service.deleteModel) {
        for (const model of ModelRegistryIndex.getClasses()) {
          if (model === SchemaRegistryIndex.getBaseClass(model)) {
            await service.deleteModel(model);
          }
        }
      }
      await service.deleteStorage();
    }
  }
}

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
      phaseHandlers: [new ModelSuiteHandler(target, qualifier)]
    });
  };
}