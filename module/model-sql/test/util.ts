import { BaseModelTest } from '@travetto/model/extension/base.test';
import { DependencyRegistry } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { TestRegistry, Test } from '@travetto/test';
import { Class } from '@travetto/registry';

export class TestUtil {
  static async init(e: BaseModelTest) {

    await import('./dialect');
    await e.init();
    const ctx = await DependencyRegistry.getInstance(AsyncContext);

    for (const t of TestRegistry.get(e.constructor as Class).tests) {
      const method = t.methodName as keyof typeof e;
      const og = e[method] as Function;
      const fn = function (this: any) {
        return ctx.run(og.bind(this));
      };
      Object.defineProperty(fn, 'name', { value: method });
      (e as any)[method] = fn;
    }
  }
}