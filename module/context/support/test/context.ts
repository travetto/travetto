import { DependencyRegistryIndex } from '@travetto/di';
import { castKey, castTo, type Class } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex, type SuitePhaseHandler } from '@travetto/test';

import { AsyncContext } from '../../src/service.ts';

class ContextSuiteHandler<T extends object> implements SuitePhaseHandler<T> {
  target: Class<T>;

  constructor(target: Class<T>) {
    this.target = target;
  }

  async beforeAll(instance: T) {
    await Registry.init();
    const ctx = await DependencyRegistryIndex.getInstance(AsyncContext);
    for (const test of Object.values(SuiteRegistryIndex.getConfig(this.target).tests)) {
      const methodName = castKey<typeof instance>(test.methodName);
      if (methodName in instance && typeof instance[methodName] === 'function') {
        const og = instance[methodName];
        const wrapped = function (this: unknown) { return ctx.run(og.bind(this)); };
        Object.defineProperty(wrapped, 'name', { value: test.methodName });
        instance[methodName] = castTo(wrapped);
      }
    }
  }
}

/**
 * Allows for defining a common suite context
 * @param data
 */
export function WithSuiteContext() {
  return (target: Class): void => {
    SuiteRegistryIndex.getForRegister(target).register({
      phaseHandlers: [new ContextSuiteHandler(target)]
    });
  };
}