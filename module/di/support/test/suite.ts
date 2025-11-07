import { Class } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';
import { SuiteRegistryIndex } from '@travetto/test';

import { DependencyRegistryIndex } from '../../src/registry/registry-index.ts';

/**
 * Registers a suite as injectable
 */
export function InjectableSuite() {
  return (target: Class) => {
    SuiteRegistryIndex.getForRegister(target).register({
      beforeEach: [
        async function (this: unknown) {
          await RegistryV2.init();
          await DependencyRegistryIndex.injectFields(this, target);
        },
      ]
    });
  };
}