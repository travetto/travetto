import { DependencyRegistryIndex } from '@travetto/di';
import { castKey, castTo, type Class } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { SuiteRegistryIndex } from '@travetto/test';

import { AsyncContext } from '../../src/service.ts';

const Init = Symbol();

function wrapped(ctx: AsyncContext, og: Function) {
  return function (this: unknown) {
    return ctx.run(og.bind(this));
  };
}

class ContextSuiteHandler<T> {
  target: Class<T>;
  wrapped: Function;

  constructor(target: Class<T>) {
    this.target = target;
  }

  async beforeEach(instance: T & { [Init]?: boolean }) {
    if (!instance[Init]) {
      instance[Init] = true;
      await Registry.init();
      const ctx = await DependencyRegistryIndex.getInstance(AsyncContext);
      for (const test of Object.values(SuiteRegistryIndex.getConfig(this.target).tests)) {
        const methodName = castKey<typeof instance>(test.methodName);
        if (methodName in instance && typeof instance[methodName] === 'function') {
          const fn = wrapped(ctx, instance[methodName]);
          Object.defineProperty(fn, 'name', { value: test.methodName });
          instance[methodName] = castTo(fn);
        }
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