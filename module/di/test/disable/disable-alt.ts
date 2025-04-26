import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { MyCustomClass3, MyCustomClass4 } from './types.ts';

@Suite()
class AltDisableSuite {

  @BeforeAll()
  before(): void {
    process.env.NAME = 'prod';
  }

  @Test()
  async allowDisableOverride() {
    await DependencyRegistry.init();
    await assert.rejects(() => DependencyRegistry.getInstance(MyCustomClass4));
    assert(await DependencyRegistry.getInstance(MyCustomClass3));
  }
}