import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { CUSTOM_EMPTY, DbConfig, Empty } from './di-config.ts';

class TestConfig {
  @InjectableFactory(CUSTOM_EMPTY)
  static getNewDb() {
    const out = new DbConfig();
    return out;
  }

  @InjectableFactory(CUSTOM_EMPTY)
  static getNewEmpty() {
    const out = new Empty();
    out.age = 20;
    console.log('Custom EMPTY 1', { out });
    return out;
  }
}

@Suite()
export class DiConfigSuite {

  @Test('factory with autowire after')
  async simpleConfig() {
    await RootRegistry.init();
    const inst = await DependencyRegistry.getInstance(DbConfig, CUSTOM_EMPTY);

    assert(inst);

    assert(inst.empty.age === 10);
  }

}