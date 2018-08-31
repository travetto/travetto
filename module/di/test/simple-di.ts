import * as assert from 'assert';
import { Suite, Test, BeforeEach } from '@travetto/test';
import { Class } from '@travetto/registry';

import { DependencyRegistry } from '../src/registry';

import {
  ServiceInherit, SERVICE_INHERIT_2, CUSTOM_SERVICE_INHERIT,
  CUSTOM_DATABASE, Database, CUSTOM_EMPTY, BasePattern,
  SpecificPattern
} from './deps';

import { DbConfig } from './config';

const FOUR = 4;

function doWork() {
  throw new Error('ahhh');
}

@Suite('di')
class DiTest {

  @Test('run')
  async run() {
    console.log('starting');
    await DependencyRegistry.init();
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

  @BeforeEach()
  async each() {
    await DependencyRegistry.init();
  }

  @Test('run')
  async run() {
    console.log('starting');
    assert(30 === 30);

    const inst = await DependencyRegistry.getInstance(ServiceInherit);
    inst.doWork();

    assert.ok(inst.db);
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

    assert(inst.empty);
  }

  @Test('abstract inheritance')
  async abstrct() {
    const types = DependencyRegistry.getCandidateTypes(BasePattern as Class<any>);
    assert(types.length > 0);

    const spec = DependencyRegistry.getCandidateTypes(SpecificPattern);
    assert(spec.length === 1);

    assert(types[0] === spec[0]);

    const specInst = await DependencyRegistry.getInstance(SpecificPattern);

    assert(specInst instanceof SpecificPattern);
  }
}