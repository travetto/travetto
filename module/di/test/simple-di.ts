import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { DependencyRegistry } from '../src/registry';

import {
  ServiceInherit, SERVICE_INHERIT_2, CUSTOM_SERVICE_INHERIT,
  CUSTOM_DATABASE, Database, CUSTOM_EMPTY, BasePattern,
  SpecificPattern, InterfaceType, BaseTypeTarget, CUSTOM_INTERFACE, UsableMainClass, UsableSubClass,
  UsableSubSubClass,
  LooseResolutionClass,
  LOOSE_SYM,
  SetterInject
} from './deps';

import { DbConfig } from './config';
import { InjectionError } from '../src/error';

const FOUR = 4;

function doWork() {
  throw new Error('ahhh');
}

@Suite('di')
class DiTest {

  @Test('run')
  async run() {
    console.log('starting');
    await RootRegistry.init();
    let inst = await DependencyRegistry.getInstance(ServiceInherit);
    inst.doWork();
    assert.ok(inst.db);
    assert(inst.age === 30);

    inst = await DependencyRegistry.getInstance(ServiceInherit, SERVICE_INHERIT_2);
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
    await RootRegistry.init();
  }

  @Test('run')
  async run() {
    console.log('starting');
    assert(30 === 30);

    const inst = await DependencyRegistry.getInstance(ServiceInherit);
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
    const inst = await DependencyRegistry.getInstance(ServiceInherit, CUSTOM_SERVICE_INHERIT);

    assert(inst);

    assert(inst.age === 11);

    // assert(inst.db.dbConfig === undefined);

    assert(inst.db.dbConfig);
    assert.ok(!inst.db.dbConfig.temp);

    assert(inst.db.dbConfig.empty.age === 10);
  }

  @Test('factory with autowire after')
  async factory2() {
    assert(true);

    const inst = await DependencyRegistry.getInstance(Database, CUSTOM_DATABASE);

    assert(inst);

    assert(inst.altConfig === undefined);

    assert.ok(inst.dbConfig);

    assert(inst.dbConfig.temp === 'any');

    assert(inst.dbConfig.empty.age === 20);
  }

  @Test('factory with autowire after')
  async factory3() {
    assert(true);

    const inst = await DependencyRegistry.getInstance(Database);

    assert(inst);

    assert(inst.altConfig === undefined);

    assert.ok(inst.dbConfig);
  }

  @Test('factory with autowire after')
  async factory4() {
    assert(true);

    const inst = await DependencyRegistry.getInstance(DbConfig, CUSTOM_EMPTY);

    assert(inst);

    assert(inst.empty.age === 10);
  }

  @Test('abstract inheritance')
  async absTract() {
    const types = DependencyRegistry.getCandidateTypes(BasePattern);
    assert(types.length > 0);

    const spec = DependencyRegistry.getCandidateTypes(SpecificPattern);
    assert(spec.length === 1);

    assert(types[0] === spec[0]);

    const specInst = await DependencyRegistry.getInstance(SpecificPattern);

    assert(specInst instanceof SpecificPattern);
  }

  @Test('interface injection')
  async intInjection() {
    const types = DependencyRegistry.getCandidateTypes(BaseTypeTarget);
    assert(types.length > 0);

    const spec = DependencyRegistry.getCandidateTypes(InterfaceType);
    assert(spec.length > 0);

    assert(types[0] === spec[0]);

    const specInst = await DependencyRegistry.getInstance(BaseTypeTarget);
    assert(specInst instanceof InterfaceType);

    const customInst = await DependencyRegistry.getInstance(BaseTypeTarget, CUSTOM_INTERFACE);
    assert(customInst instanceof InterfaceType);
  }

  @Test('overriden via subclass')
  async subclassVerification() {
    const types = DependencyRegistry.getCandidateTypes(UsableMainClass);
    assert(types.length === 2);

    const spec = DependencyRegistry.getCandidateTypes(UsableSubClass);
    assert(spec.length === 1);

    const specInst = await DependencyRegistry.getInstance(UsableSubClass);
    assert(specInst.constructor === UsableSubClass);


    const specSpec = DependencyRegistry.getCandidateTypes(UsableSubSubClass);
    assert(specSpec.length === 2);

    await assert.rejects(() => DependencyRegistry.getInstance(UsableSubSubClass), /Multiple candidate/i);
  }

  @Test('loose resolution')
  async looseResolution() {
    const types = DependencyRegistry.getCandidateTypes(LooseResolutionClass);
    assert(types.length === 2);

    const inst = await DependencyRegistry.getInstance(LooseResolutionClass);

    const spec = await DependencyRegistry.getInstance(LooseResolutionClass, LOOSE_SYM);

    assert(spec.name !== inst.name);

    await assert.rejects(() => DependencyRegistry.getInstance(LooseResolutionClass, Symbol.for('')), InjectionError);

    await assert.doesNotReject(() => DependencyRegistry.getInstance(LooseResolutionClass, Symbol.for(''), 'loose'), InjectionError);

    const specLoose = await DependencyRegistry.getInstance(LooseResolutionClass, Symbol.for(''), 'loose');

    assert(specLoose.name === inst.name);
  }

  @Test('Setter')
  async testSetter() {
    const inst = await DependencyRegistry.getInstance(SetterInject);
    assert(inst._prop instanceof LooseResolutionClass);
  }
}
