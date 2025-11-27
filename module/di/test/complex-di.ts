import assert from 'node:assert';

import { Suite, Test, BeforeEach } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { asFull, toConcrete } from '@travetto/runtime';

import { Injectable, InjectableFactory, DependencyRegistryIndex } from '@travetto/di';

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

/**
 * @concrete
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
    return Registry.init();
  }

  @Test()
  async commonWithDuplicates() {
    await assert.rejects(() => DependencyRegistryIndex.getInstance(Common), /multiple/i);
  }

  @Test()
  async commonWithSingle() {
    assert(await DependencyRegistryIndex.getInstance(CommonWithSingle) instanceof SubCommonSingle);
  }

  @Test()
  async commonWithPrimary() {
    assert(await DependencyRegistryIndex.getInstance(CommonWithPrimary) instanceof SubCommonWithPrimaryA);
  }

  @Test()
  async commonWithCustom() {
    assert(await DependencyRegistryIndex.getInstance(CommonWithCustom) instanceof SubCommonWithCustomB);
  }

  @Test()
  async commonWithCustomFactory() {
    assert(await DependencyRegistryIndex.getInstance(CommonWithFactory) instanceof CommonWithFactory);
  }

  @Test()
  async primaryWithFactory() {
    assert(!(await DependencyRegistryIndex.getInstance(PrimaryWithFactory) instanceof SubPrimaryWithFactoryA));
  }

  @Test()
  async primaryTargetFactory() {
    assert(!!(await DependencyRegistryIndex.getInstance(toConcrete<PrimaryTargetInterface>())));
  }
}