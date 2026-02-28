import { type Class } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex } from '@travetto/test';

import { DependencyRegistryIndex } from '../../src/registry/registry-index.ts';

class ModelSuiteHandler {
  target: Class;
  constructor(target: Class) {
    this.target = target;
  }

  async beforeEach(instance: unknown) {
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