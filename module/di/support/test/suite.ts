import { Class } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';
import { SuiteRegistryIndex } from '@travetto/test';

import { DependencyRegistryIndex } from '../../src/registry/registry-index.ts';

/**
 * Registers a suite as injectable
 * @kind decorator
 */
export function InjectableSuite() {
  return (cls: Class) => {
    SuiteRegistryIndex.getForRegister(cls).register({
      beforeEach: [
        async function (this: unknown) {
          await RegistryV2.init();
          await DependencyRegistryIndex.injectFields(this, cls);
        },
      ]
    });
  };
}