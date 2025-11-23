import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { InjectionError, DependencyRegistryIndex } from '@travetto/di';
import { RegistryV2 } from '@travetto/registry';

import { MyCustomClass3, MyCustomClass4 } from './types.ts';

@Suite()
class AltDisableSuite {

  @BeforeAll()
  before(): void {
    process.env.NAME = 'prod';
  }

  @Test()
  async allowDisableOverride() {
    await RegistryV2.init();
    await assert.rejects(() => DependencyRegistryIndex.getInstance(MyCustomClass4), InjectionError);
    assert(await DependencyRegistryIndex.getInstance(MyCustomClass3));
  }
}