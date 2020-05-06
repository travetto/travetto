import { Injectable, Inject, InjectableFactory } from '../';
import { DbConfig, AltConfig, Empty } from './config';

export abstract class BasePattern { }

@Injectable()
export class SpecificPattern extends BasePattern {

}

@Injectable()
export class Database {
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
export class Service {

  constructor(public db: Database) {
    console.log('Creating service', db);
  }

  doWork() {
    this.db.query();
  }
}

@Injectable()
export class ServiceInherit extends Service {
  name = 'bob';
  age = 30;
  doWork() {
    this.db.query();
  }
}

export const SERVICE_INHERIT_2 = Symbol.for('SVC_I_2');
export const SERVICE_INHERIT_3 = Symbol.for('SVC_I_3');

@Injectable(SERVICE_INHERIT_2)
export class ServiceInherit2 extends ServiceInherit {
  age = 31;
}

export const CUSTOM_SERVICE_INHERIT = Symbol.for('Custom');
export const CUSTOM_DATABASE = Symbol.for('CUSTOM DB');
export const CUSTOM_EMPTY = Symbol.for('Custom EMPTY');

class TestConfig {
  @InjectableFactory(CUSTOM_EMPTY)
  static getNewDb() {
    const out = new DbConfig();
    return out;
  }

  @InjectableFactory(CUSTOM_EMPTY)
  static getNewEmpty() {
    const out = new Empty();
    out.age = 20;
    console.log('Custom EMPTY 1', out);
    return out;
  }

  @InjectableFactory(CUSTOM_SERVICE_INHERIT)
  static getObject(@Inject(SERVICE_INHERIT_2) svc: ServiceInherit) {
    console.log('Did I find service 2', svc, svc?.db);
    const out: ServiceInherit = new ServiceInherit2(svc?.db ?? new Database());
    out.age = 11;
    return out;
  }

  @InjectableFactory(CUSTOM_DATABASE)
  static getCustomDB(@Inject(CUSTOM_EMPTY) empty: Empty) {
    console.log('Custom EMPTY 2', empty);
    const config = new DbConfig();
    config.temp = 'any';
    config.empty = empty;

    const ret = new Database();
    ret.dbConfig = config;
    return ret;
  }
}
