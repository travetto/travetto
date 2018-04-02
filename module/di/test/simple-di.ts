import { DependencyRegistry } from '../src/service';
import { ServiceInherit, SERVICE_INHERIT_2, CUSTOM_SERVICE_INHERIT, CUSTOM_DATABSE, Database } from './deps';
import { Suite, Test, BeforeEach } from '@travetto/test';
import * as assert from 'assert';

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
    console.log('hi')

    assert(2 + 2 === FOUR);
  }

  @Test('factory')
  async factory() {
    assert(true);
    const inst = await DependencyRegistry.getInstance(ServiceInherit, CUSTOM_SERVICE_INHERIT);

    assert(inst);

    assert(inst.age === 11);

    assert(inst.db.dbConfig);
    assert.ok(!inst.db.dbConfig.temp);

    assert(inst.db.dbConfig.empty.age === 10);
  }

  @Test('factory with autowire after')
  async factory2() {
    assert(true);

    const inst = await DependencyRegistry.getInstance(Database, CUSTOM_DATABSE);

    assert(inst);

    assert(inst.altConfig === undefined);

    assert.ok(inst.dbConfig);

    assert(inst.dbConfig.temp === 'any');

    assert(inst.dbConfig.empty.age === 20);
  }
}