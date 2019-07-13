import { BeforeAll, AfterEach, AfterAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { BaseModelTest } from '@travetto/model/extension/base.test';

import { SQLModelConfig } from '../src/config';

export class BaseSqlTest extends BaseModelTest {

  configClass = SQLModelConfig;

  @BeforeAll()
  async init() {
    await super.init();

    const ctx = await DependencyRegistry.getInstance(AsyncContext);
    const proto = Object.getPrototypeOf(this);

    for (const k of Object.getOwnPropertyNames(proto)) {
      const og = proto[k];
      proto[k] = function () { return ctx.run(og.bind(this)); };
    }
  }

  @AfterEach() reinit() { return super.reinit(); }
  @AfterAll() clear() { return super.clear(); }
}