import { assert } from 'console';

import { RootRegistry } from '@travetto/registry';
import { SubType } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { Model } from '../src/registry/decorator';

@Model()
abstract class Base {
  id: string;
  type?: string;
}

@Model()
@SubType('weird')
class Sub extends Base { }

@Model()
class Sub2 extends Base { }

@Suite()
class ModelRegistrySuite {
  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  validateSubType() {
    assert(Sub.from({}).type === 'weird');
    assert(Sub2.from({}).type === 'sub2');
  }
}