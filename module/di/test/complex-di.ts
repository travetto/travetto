import assert from 'node:assert';

import { Suite, Test, BeforeEach } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { asFull } from '@travetto/runtime';

import { DependencyRegistry } from '../src/registry.ts';
import { Injectable, InjectableFactory } from '../src/decorator.ts';

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

abstract class PrimaryWithFactory { }
@Injectable()
class SubPrimaryWithFactoryA extends PrimaryWithFactory { }

class PrimaryFactory {
  @InjectableFactory({ primary: true })
  static getPrimaryFactory(): PrimaryWithFactory {
    return asFull({});
  }
}

class PrimaryTargetClass { }

/**
 * @concrete #PrimaryTargetClass
 */
interface PrimaryTargetInterface {
  name: string;
}

class PrimaryTargetFactory {
  @InjectableFactory({ primary: true })
  static getPrimaryFactory(): PrimaryTargetInterface {
    return { name: 'primary' };
  }

  @InjectableFactory()
  static getPrimaryFactoryAlt(): PrimaryTargetInterface {
    return { name: 'alt' };
  }
}

@Suite('complex-di')
class ComplexDiTest {

  @BeforeEach()
  init() {
    return RootRegistry.init();
  }

  @Test()
  async commonWithDuplicates() {
    await assert.rejects(() => DependencyRegistry.getInstance(Common), /multiple/i);
  }

  @Test()
  async commonWithSingle() {
    assert(await DependencyRegistry.getInstance(CommonWithSingle) instanceof SubCommonSingle);
  }

  @Test()
  async commonWithPrimary() {
    assert(await DependencyRegistry.getInstance(CommonWithPrimary) instanceof SubCommonWithPrimaryA);
  }

  @Test()
  async commonWithCustom() {
    assert(await DependencyRegistry.getInstance(CommonWithCustom) instanceof SubCommonWithCustomB);
  }

  @Test()
  async commonWithCustomFactory() {
    assert(await DependencyRegistry.getInstance(CommonWithFactory) instanceof CommonWithFactory);
  }

  @Test()
  async primaryWithFactory() {
    assert(!(await DependencyRegistry.getInstance(PrimaryWithFactory) instanceof SubPrimaryWithFactoryA));
  }

  @Test()
  async primaryTargetFactory() {
    assert(!!(await DependencyRegistry.getInstance(PrimaryTargetClass)));
  }
}