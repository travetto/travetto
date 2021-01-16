import { DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/base';
import { SuiteRegistry } from '@travetto/test';

import { AsyncContext } from '../src/service';

/**
 * Allows for defining a common suite context
 * @param data
 */
export function WithSuiteContext(data: Record<string, unknown> = {}) {
  return (target: Class) => {
    SuiteRegistry.register(target, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      beforeEach: [async function (this: { __initialized?: boolean } & Record<string, Function>) {
        if (!this.__initialized) {
          this.__initialized = true;
          const ctx = await DependencyRegistry.getInstance(AsyncContext);
          for (const t of SuiteRegistry.get(target).tests) {
            const og = this[t.methodName] as Function;
            // eslint-disable-next-line no-shadow
            const fn = function (this: unknown) {
              return ctx.run(og.bind(this), JSON.parse(JSON.stringify(data)));
            };
            Object.defineProperty(fn, 'name', { value: t.methodName });
            this[t.methodName] = fn;
          }
        }
      }],
    });
  };
}