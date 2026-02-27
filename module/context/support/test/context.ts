import { DependencyRegistryIndex } from '@travetto/di';
import { describeFunction, type Class } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
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
      phaseHandlers: [{
        type: 'beforeEach',
        import: describeFunction(WithSuiteContext).import,
        async action(this: { [Init]?: boolean } & Record<string, Function>) {
          if (!this[Init]) {
            this[Init] = true;
            await Registry.init();
            const ctx = await DependencyRegistryIndex.getInstance(AsyncContext);
            for (const [k, t] of Object.entries(SuiteRegistryIndex.getConfig(target).tests)) {
              const fn = wrapped(ctx, this[t.methodName]);
              Object.defineProperty(fn, 'name', { value: t.methodName });
              this[t.methodName] = fn;
            }
          }
        }
      }]
    });
  };
}