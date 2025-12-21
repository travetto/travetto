import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { DependencyRegistryIndex, InjectableFactory } from '@travetto/di';
import { Registry } from '@travetto/registry';

import { CustomEmptySymbol, DbConfig, Empty } from './di-config.ts';

class TestConfig {
  @InjectableFactory(CustomEmptySymbol)
  static getNewDb() {
    const out = new DbConfig();
    return out;
  }

  @InjectableFactory(CustomEmptySymbol)
  static getNewEmpty() {
    const out = new Empty();
    out.age = 20;
    console.log('Custom EMPTY 1', { out });
    return out;
  }
}

@Suite()
class DiConfigSuite {

  @Test('factory with autowire after')
  async simpleConfig() {
    await Registry.init();
    const inst = await DependencyRegistryIndex.getInstance(DbConfig, CustomEmptySymbol);

    assert(inst);

    assert(inst.empty.age === 10);
  }

}