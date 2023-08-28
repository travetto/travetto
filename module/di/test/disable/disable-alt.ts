import assert from 'assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { DependencyRegistry } from '../../__index__';

import { MyCustomClass3, MyCustomClass4 } from './types';

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