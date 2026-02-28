import { type Class } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex, type SuitePhaseHandler } from '@travetto/test';

import { DependencyRegistryIndex } from '../../src/registry/registry-index.ts';

class ModelSuiteHandler<T extends object> implements SuitePhaseHandler<T> {
  target: Class;
  constructor(target: Class<T>) {
    this.target = target;
  }

  async beforeEach(instance: T) {
    await Registry.init();
    await DependencyRegistryIndex.injectFields(instance, this.target);
  }
}

/**
 * Registers a suite as injectable
 * @kind decorator
 */
export function InjectableSuite() {
  return (cls: Class) => {
    SuiteRegistryIndex.getForRegister(cls).register({
      phaseHandlers: [new ModelSuiteHandler(cls)]
    });
  };
}