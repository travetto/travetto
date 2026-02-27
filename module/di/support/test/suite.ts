import type { Class } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex } from '@travetto/test';

import { DependencyRegistryIndex } from '../../src/registry/registry-index.ts';

/**
 * Registers a suite as injectable
 * @kind decorator
 */
export function InjectableSuite() {
  return (cls: Class) => {
    SuiteRegistryIndex.getForRegister(cls).register({
      phaseHandlers: [{
        type: 'beforeEach',
        import: '@travetto/model/support/test/suite.ts',
        async action(this: unknown) {
          await Registry.init();
          await DependencyRegistryIndex.injectFields(this, cls);
        },
      }]
    });
  };
}