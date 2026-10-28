import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Util, type Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';
import { type SuitePhaseHandler, SuiteRegistryIndex, TestFixtures } from '@travetto/test';

import { ModelRegistryIndex } from '../../src/registry/registry-index.ts';
import { ModelStorageUtil } from '../../src/util/storage.ts';

type ConfigType = { autoCreate?: boolean; namespace?: string; modifyStorage?: boolean; readBeforeUpdate?: boolean };

class ModelSuiteHandler<T extends { configClass: Class<ConfigType>; serviceClass: Class }> implements SuitePhaseHandler<T> {
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
      config.namespace = `test_${Util.randomId(12)}`;
    }

    // We manually create
    config.autoCreate = false;

    if ('readBeforeUpdate' in config) {
      config.readBeforeUpdate = true;
    }

    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
    if (ModelStorageUtil.isSupported(service)) {
      await service.createStorage();
    }
  }

  async beforeEach(instance: T) {
    const config = await DependencyRegistryIndex.getInstance<ConfigType>(instance.configClass);
    if ('readBeforeUpdate' in config) {
      config.readBeforeUpdate = true;
    }

    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
    if (ModelStorageUtil.isSupported(service)) {
      await Promise.all(
        ModelRegistryIndex.getClasses()
          .filter(cls => cls === SchemaRegistryIndex.getBaseClass(cls))
          .map(modelCls => service.upsertModel?.(modelCls))
      );
    }
  }

  async afterEach(instance: T) {
    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
    if (ModelStorageUtil.isSupported(service)) {
      await service.truncateBlob?.();
      const models = ModelRegistryIndex.getClasses().filter(model => model === SchemaRegistryIndex.getBaseClass(model));
      if ('truncateModels' in service && typeof service.truncateModels === 'function') {
        await service.truncateModels(models);
      } else {
        await Promise.all(models.map(model => service.truncateModel(model)));
      }
    }
  }

  async afterAll(instance: T) {
    const service = await DependencyRegistryIndex.getInstance<T>(instance.serviceClass, this.qualifier);
    if (ModelStorageUtil.isSupported(service)) {
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
export function ModelSuite<T extends { configClass: Class<ConfigType>; serviceClass: Class }>(qualifier?: symbol) {
  const fixtures = new TestFixtures(['@travetto/model']);
  return (target: Class<T>): void => {
    target.prototype.fixtures = fixtures;
    SuiteRegistryIndex.getForRegister(target).register({
      phaseHandlers: [new ModelSuiteHandler(target, qualifier)]
    });
  };
}
