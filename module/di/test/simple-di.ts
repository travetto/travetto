import { DependencyRegistry } from '../src/service';
import { ServiceInherit, SERVICE_INHERIT_2 } from './deps';
import { Suite, Test } from '@travetto/test';
import * as assert from 'assert';

const FOUR = 4;

function doWork() {
  // throw new Error('ahhh');
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
    assert(inst.age === 30);

    assert.equal(inst.db.altConfig, undefined);
    assert(inst.db.dbConfig.getUrl() === 'mongodb://oscar');
  }

  @Test('runner')
  async runner() {

    assert(1 === 1);
    assert(2 + 2 === FOUR);

    doWork();
  }
}

@Suite('di2')
class DiTest2 {


  @Test('run')
  async run() {
    console.log('starting');
    await DependencyRegistry.init();
    assert(30 === 30);

    let inst = await DependencyRegistry.getInstance(ServiceInherit);
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
}