import { castTo, Class, ClassInstance } from '@travetto/runtime';
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
          await RegistryV2.instance(DependencyRegistryIndex).injectFields(castTo<ClassInstance>(this), target);
        },
      ]
    });
  };
}