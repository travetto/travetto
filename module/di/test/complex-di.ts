import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { DependencyRegistry } from '../src/registry';

import { Injectable, InjectableFactory } from '../src/decorator';


abstract class Common { }
@Injectable()
class SubCommonA extends Common { }

@Injectable()
class SubCommonB extends Common { }

abstract class CommonWithSingle { }
@Injectable()
class SubCommonSingle extends CommonWithSingle { }

abstract class CommonWithPrimary { }
@Injectable({ primary: true })
class SubCommonWithPrimaryA extends CommonWithPrimary { }

@Injectable()
class SubCommonWithPrimaryB extends CommonWithPrimary { }


abstract class CommonWithCustom { }
@Injectable(Symbol.for('blah'))
class SubCommonWithCustomA extends CommonWithCustom { }

@Injectable()
class SubCommonWithCustomB extends CommonWithCustom { }

abstract class CommonWithFactory { }
@Injectable(Symbol.for('blah'))
class SubCommonWithFactoryA extends CommonWithFactory { }

class CustomFactory {
  @InjectableFactory()
  static getCommonFactory(): CommonWithFactory {
    return new class extends CommonWithFactory {

    }();
  }
}


@Suite('complex-di')
class ComplexDiTest {

  @Test()
  async commonWithDuplicates() {
    await RootRegistry.init();
    await assert.rejects(() => DependencyRegistry.getInstance(Common), /multiple/i);
  }

  @Test()
  async commonWithSingle() {
    await RootRegistry.init();
    assert(await DependencyRegistry.getInstance(CommonWithSingle) instanceof SubCommonSingle);
  }

  @Test()
  async commonWithPrimary() {
    await RootRegistry.init();
    assert(await DependencyRegistry.getInstance(CommonWithPrimary) instanceof SubCommonWithPrimaryA);
  }

  @Test()
  async commonWithCustom() {
    await RootRegistry.init();
    assert(await DependencyRegistry.getInstance(CommonWithCustom) instanceof SubCommonWithCustomB);
  }

  @Test()
  async commonWithCustomFactory() {
    await RootRegistry.init();
    assert(await DependencyRegistry.getInstance(CommonWithFactory) instanceof CommonWithFactory);
  }
}