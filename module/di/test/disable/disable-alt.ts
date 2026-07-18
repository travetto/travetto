import assert from 'node:assert';

import { DependencyRegistryIndex, InjectionError } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { MyCustomClass3, MyCustomClass4 } from './types.ts';

@Suite()
class AltDisableSuite {
  @BeforeAll()
  before(): void {
    process.env.NAME = 'production';
  }

  @Test()
  async allowDisableOverride() {
    await Registry.init();
    await assert.rejects(() => DependencyRegistryIndex.getInstance(MyCustomClass4), InjectionError);
    assert(await DependencyRegistryIndex.getInstance(MyCustomClass3));
  }
}
