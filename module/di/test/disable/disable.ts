import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';

import { MyCustomClass, MyCustomClass2, MyCustomClass3, MyCustomClass4 } from './types.ts';

@Suite()
class DisableSuite {

  @BeforeAll()
  beforeAll(): void {
    process.env.NAME = 'test';
  }

  @Test()
  async ensureDisableClass() {
    await Registry.init();
    await assert.rejects(() => DependencyRegistryIndex.getInstance(MyCustomClass));
    assert(await DependencyRegistryIndex.getInstance(MyCustomClass2));
    await assert.rejects(() => DependencyRegistryIndex.getInstance(MyCustomClass3));
    assert(await DependencyRegistryIndex.getInstance(MyCustomClass4));
  }
}