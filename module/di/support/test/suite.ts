import { castTo, Class, ClassInstance } from '@travetto/runtime';
import { RootRegistry } from '@travetto/registry';
import { SuiteRegistry } from '@travetto/test';

import { DependencyRegistry } from '../../src/registry';

/**
 * Registers a suite as injectable
 */
export function InjectableSuite() {
  return (target: Class) => {
    SuiteRegistry.registerPendingListener(
      target,
      async function (this: unknown) {
        await RootRegistry.init();
        await DependencyRegistry.injectFields(castTo<ClassInstance>(this), target);
      },
      'beforeEach'
    );
  };
}