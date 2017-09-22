import { Injectable, Inject } from '../src/decorator/injectable';
import { DbConfig, AltConfig } from './config';
import { DependencyRegistry } from '../src/service';
import { Suite, Test } from '@encore2/test'
import * as assert from 'assert';

@Injectable()
class Database {
  @Inject() dbConfig: DbConfig<any, any>;
  @Inject({ optional: true }) altConfig: AltConfig;

  postConstruct() {
    console.log('Creating database', this.dbConfig.getUrl());
  }

  query() {
    console.log('Getting 350', this.dbConfig.getUrl());
  }
}

@Injectable()
class Service {

  constructor(public db: Database) {
    console.log('Creating service', db);
  }

  doWork() {
    this.db.query();
  }
}

@Injectable()
class ServiceInherit extends Service {
  name = 'bob';
  age = 30;
  doWork() {
    this.db.query();
  }
}

@Suite('di')
class DiTest {

  @Test('run')
  async run() {
    console.log('starting')
    await DependencyRegistry.init();
    let inst = await DependencyRegistry.getInstance(ServiceInherit);
    inst.doWork();
    assert(inst.age === 30);
    assert.ok(inst.db);
    assert(inst.db.dbConfig.getUrl() === 'mongodb://oscar');
    assert.equal(inst.db.altConfig, undefined);
  }
}