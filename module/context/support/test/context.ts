import { DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';
import { SuiteRegistryIndex } from '@travetto/test';

import { AsyncContext } from '../../src/service.ts';

const Init = Symbol();

/**
 * Allows for defining a common suite context
 * @param data
 */
export function WithSuiteContext() {
  return (target: Class): void => {
    function wrapped(ctx: AsyncContext, og: Function) {
      return function (this: unknown) {
        return ctx.run(og.bind(this));
      };
    }

    SuiteRegistryIndex.getForRegister(target).register({
      beforeEach: [
        async function (this: { [Init]?: boolean } & Record<string, Function>) {
          if (!this[Init]) {
            this[Init] = true;
            await RegistryV2.init();
            const ctx = await DependencyRegistry.getInstance(AsyncContext);
            for (const t of SuiteRegistryIndex.getConfig(target).tests) {
              const fn = wrapped(ctx, this[t.methodName]);
              Object.defineProperty(fn, 'name', { value: t.methodName });
              this[t.methodName] = fn;
            }
          }
        }
      ]
    });
  };
}