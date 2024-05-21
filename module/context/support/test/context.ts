import { DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { SuiteRegistry } from '@travetto/test';

import { AsyncContext } from '../../src/service';

const Init = Symbol();

/**
 * Allows for defining a common suite context
 * @param data
 */
export function WithSuiteContext(data: Record<string, unknown> = {}) {
  return (target: Class): void => {
    function wrapped(ctx: AsyncContext, og: Function) {
      return function (this: unknown) {
        return ctx.run(og.bind(this), structuredClone(data));
      };
    }

    SuiteRegistry.registerPendingListener(target,
      async function (this: { [Init]?: boolean } & Record<string, Function>) {
        if (!this[Init]) {
          this[Init] = true;
          await RootRegistry.init();
          const ctx = await DependencyRegistry.getInstance(AsyncContext);
          for (const t of SuiteRegistry.get(target).tests) {
            const fn = wrapped(ctx, this[t.methodName] as Function);
            Object.defineProperty(fn, 'name', { value: t.methodName });
            this[t.methodName] = fn;
          }
        }
      },
      'beforeEach'
    );
  };
}