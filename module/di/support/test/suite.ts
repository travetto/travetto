import { Class, ClassInstance } from '@travetto/runtime';
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
      async function (this: Record<string, Function>) {
        await RootRegistry.init();
        await DependencyRegistry.injectFields(this as ClassInstance, target);
      },
      'beforeEach'
    );
  };
}