import { DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { SuiteRegistry } from '@travetto/test';

import { AsyncContext } from '../../src/service';

/**
 * Allows for defining a common suite context
 * @param data
 */
export function WithSuiteContext(data: any = {}) {
  return (target: Class) => {
    SuiteRegistry.register(target, {
      beforeEach: [async function (this: any) {
        if (!this.__initialized) {
          this.__initialized = true;
          const ctx = await DependencyRegistry.getInstance(AsyncContext);
          for (const t of SuiteRegistry.get(target).tests) {
            const og = this[t.methodName] as Function;
            // eslint-disable-next-line no-shadow
            const fn = function (this: any) {
              return ctx.run(og.bind(this), JSON.parse(JSON.stringify(data)));
            };
            Object.defineProperty(fn, 'name', { value: t.methodName });
            (this as any)[t.methodName] = fn;
          }
        }
      }],
    });
  };
}