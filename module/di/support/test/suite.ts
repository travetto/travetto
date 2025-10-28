import { castTo, Class, ClassInstance } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';
import { SuiteRegistry } from '@travetto/test';

import { DependencyRegistry } from '../../src/registry.ts';

/**
 * Registers a suite as injectable
 */
export function InjectableSuite() {
  return (target: Class) => {
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: unknown) {
        await RegistryV2.init();
        await DependencyRegistry.injectFields(castTo<ClassInstance>(this), target);
      },
      'beforeEach'
    );
  };
}