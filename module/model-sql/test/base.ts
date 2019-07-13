import { BeforeAll, AfterEach, AfterAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ModelSource, ModelRegistry } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';
import { AsyncContext } from '@travetto/context';

import { SQLModelConfig } from '../';
import { SQLModelSource } from '../src/source';

export class BaseSqlTest {

  @BeforeAll()
  async before() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
    const config = await DependencyRegistry.getInstance(SQLModelConfig);
    config.namespace = `test_${Math.trunc(Math.random() * 10000)}`;
    await ModelRegistry.init();

    const ctx = await DependencyRegistry.getInstance(AsyncContext);

    const proto = Object.getPrototypeOf(this);
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (!k.startsWith('before') && !k.startsWith('after')) {
        const og = proto[k];
        proto[k] = function () { return ctx.run(og.bind(this)); };
      }
    }
  }

  @AfterAll()
  @AfterEach()
  async clear() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as SQLModelSource;
    await mms.clearDatabase();
  }

  @AfterEach()
  async reset() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as SQLModelSource;
    await mms.postConstruct();
  }
}