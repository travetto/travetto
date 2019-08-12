import { BaseModelTest } from '@travetto/model/extension/base.test';
import { DependencyRegistry } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

export class TestUtil {
  static async init(e: BaseModelTest) {
    // tslint:disable-next-line: no-import-side-effect
    await import('./dialect');

    await e.init();

    const ctx = await DependencyRegistry.getInstance(AsyncContext);
    const proto = Object.getPrototypeOf(e);

    for (const k of Object.getOwnPropertyNames(proto)) {
      const og = proto[k];
      proto[k] = function () { return ctx.run(og.bind(e)); };
    }
  }
}