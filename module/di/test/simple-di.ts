import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RegistryV2 } from '@travetto/registry';
import { toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex, InjectionError } from '@travetto/di';

import {
  ServiceInherit, ServiceInheritSymbol2, CustomServiceInheritSymbol,
  CustomDatabaseSymbol, Database, CustomEmptySymbol, BasePattern,
  SpecificPattern, InterfaceType, BaseType, CustomInterfaceSymbol, UsableMainClass, UsableSubClass,
  UsableSubSubClass, LooseResolutionClass, LooseSymbol, SetterInject
} from './deps.ts';

import { DbConfig } from './config.ts';

const FOUR = 4;

function doWork() {
  throw new Error('Uh-oh');
}

@Suite('di')
class DiTest {

  @Test('run')
  async run() {
    console.log('starting');
    await RegistryV2.init();
    let inst = await DependencyRegistryIndex.getInstance(ServiceInherit);
    inst.doWork();
    assert.ok(inst.db);
    assert(inst.age === 30);

    inst = await DependencyRegistryIndex.getInstance(ServiceInherit, ServiceInheritSymbol2);
    inst.doWork();
    assert.ok(inst.db);
    assert(inst.age === 31);

    assert.equal(inst.db.altConfig, undefined);
    assert(inst.db.dbConfig.getUrl() === 'mongodb://oscar');
  }

  @Test('runner')
  async runner() {

    assert(1 === 1);

    assert(2 + 2 === FOUR);

    assert.throws(doWork, Error);
  }
}

@Suite('di2')
class DiTest2 {

  @BeforeAll()
  async beforeAll() {
    await RegistryV2.init();
  }

  @Test('run')
  async run() {
    console.log('starting');
    assert(30 === 30);

    const inst = await DependencyRegistryIndex.getInstance(ServiceInherit);
    assert.ok(inst.db);

    inst.doWork();

    assert(inst.age === 30);

    assert.equal(inst.db.altConfig, undefined);

    assert(inst.db.dbConfig.getUrl() === 'mongodb://oscar');
  }

  @Test('runner')
  async runner() {
    assert(1 === 1);
    console.log('hi');

    assert(2 + 2 === FOUR);
  }

  @Test('factory')
  async factory() {
    assert(true);
    const inst = await DependencyRegistryIndex.getInstance(ServiceInherit, CustomServiceInheritSymbol);

    assert(inst);

    assert(inst.age === 11);

    // assert(inst.db.dbConfig === undefined);

    assert(inst.db.dbConfig);
    assert.ok(!inst.db.dbConfig.temp);

    assert(inst.db.dbConfig.empty.age === 10);
  }

  @Test('factory with auto-wire after')
  async factory2() {
    assert(true);

    const inst = await DependencyRegistryIndex.getInstance(Database, CustomDatabaseSymbol);

    assert(inst);

    assert(inst.altConfig === undefined);

    assert.ok(inst.dbConfig);

    assert(inst.dbConfig.temp === 'any');

    assert(inst.dbConfig.empty.age === 20);
  }

  @Test('factory with auto-wire after')
  async factory3() {
    assert(true);

    const inst = await DependencyRegistryIndex.getInstance(Database);

    assert(inst);

    assert(inst.altConfig === undefined);

    assert.ok(inst.dbConfig);
  }

  @Test('factory with auto-wire after')
  async factory4() {
    assert(true);

    const inst = await DependencyRegistryIndex.getInstance(DbConfig, CustomEmptySymbol);

    assert(inst);

    assert(inst.empty.age === 10);
  }

  @Test('abstract inheritance')
  async absTract() {
    const types = DependencyRegistryIndex.getCandidateTypes(BasePattern);
    assert(types.length > 0);

    const spec = DependencyRegistryIndex.getCandidateTypes(SpecificPattern);
    assert(spec.length === 1);

    assert(types[0] === spec[0]);

    const specInst = await DependencyRegistryIndex.getInstance(SpecificPattern);

    assert(specInst instanceof SpecificPattern);
  }

  @Test('interface injection')
  async intInjection() {
    const BaseTypeTarget = toConcrete<BaseType>();
    const types = DependencyRegistryIndex.getCandidateTypes(BaseTypeTarget);
    assert(types.length > 0);

    const spec = DependencyRegistryIndex.getCandidateTypes(InterfaceType);
    assert(spec.length > 0);

    assert(types[0] === spec[0]);

    const specInst = await DependencyRegistryIndex.getInstance(BaseTypeTarget);
    assert(specInst instanceof InterfaceType);

    const customInst = await DependencyRegistryIndex.getInstance(BaseTypeTarget, CustomInterfaceSymbol);
    assert(customInst instanceof InterfaceType);
  }

  @Test('overridden via subclass')
  async subclassVerification() {
    const types = DependencyRegistryIndex.getCandidateTypes(UsableMainClass);
    assert(types.length === 2);

    const spec = DependencyRegistryIndex.getCandidateTypes(UsableSubClass);
    assert(spec.length === 1);

    const specInst = await DependencyRegistryIndex.getInstance(UsableSubClass);
    assert(specInst.constructor === UsableSubClass);

    const specSpec = DependencyRegistryIndex.getCandidateTypes(UsableSubSubClass);
    assert(specSpec.length === 2);

    await assert.rejects(() => DependencyRegistryIndex.getInstance(UsableSubSubClass), /Multiple candidate/i);
  }

  @Test('loose resolution')
  async looseResolution() {
    const types = DependencyRegistryIndex.getCandidateTypes(LooseResolutionClass);
    assert(types.length === 2);

    const inst = await DependencyRegistryIndex.getInstance(LooseResolutionClass);

    const spec = await DependencyRegistryIndex.getInstance(LooseResolutionClass, LooseSymbol);

    assert(spec.name !== inst.name);

    await assert.rejects(() => DependencyRegistryIndex.getInstance(LooseResolutionClass, Symbol.for('')), InjectionError);

    await assert.doesNotReject(() => DependencyRegistryIndex.getInstance(LooseResolutionClass, Symbol.for(''), 'loose'), InjectionError);

    const specLoose = await DependencyRegistryIndex.getInstance(LooseResolutionClass, Symbol.for(''), 'loose');

    assert(specLoose.name === inst.name);
  }

  @Test('Setter')
  async testSetter() {
    const inst = await DependencyRegistryIndex.getInstance(SetterInject);
    assert(inst._prop instanceof LooseResolutionClass);
  }
}
