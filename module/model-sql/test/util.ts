import { BaseModelTest } from '@travetto/model/extension/base.test';
import { DependencyRegistry } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

export class TestUtil {
  static async init(e: BaseModelTest) {
    await import('./dialect');

    await e.init();

    const ctx = await DependencyRegistry.getInstance(AsyncContext);
    let proto = Object.getPrototypeOf(e);
    while (proto && proto !== Object) {
      for (const k of Object.getOwnPropertyNames(proto)) {
        const og = proto[k];
        if (og && og.call && og.name && og.name !== 'constructor' && !og.name.startsWith('__')) {
          try {
            proto[k] = function () { return ctx.run(og.bind(e)); };
          } catch { }
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
}