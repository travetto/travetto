import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';

import { DependencyRegistry } from '../../src/registry.ts';

import { MyCustomClass, MyCustomClass2, MyCustomClass3, MyCustomClass4 } from './types.ts';

@Suite()
class DisableSuite {

  @BeforeAll()
  beforeAll(): void {
    process.env.NAME = 'test';
  }

  @Test()
  async ensureDisableClass() {
    await DependencyRegistry.init();
    await assert.rejects(() => DependencyRegistry.getInstance(MyCustomClass));
    assert(await DependencyRegistry.getInstance(MyCustomClass2));
    await assert.rejects(() => DependencyRegistry.getInstance(MyCustomClass3));
    assert(await DependencyRegistry.getInstance(MyCustomClass4));
  }
}