import { Injectable, Inject, InjectableFactory } from '../src';
import { DbConfig, AltConfig } from './config';

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

export const SERVICE_INHERIT_2 = Symbol()

@Injectable({ qualifier: SERVICE_INHERIT_2 })
export class ServiceInherit2 extends ServiceInherit {
  age = 31;
}

export const CUSTOM_SERVICE_INHERIT = Symbol('Custom');

class TestConfig {
  @InjectableFactory({ class: ServiceInherit, qualifier: CUSTOM_SERVICE_INHERIT })
  static getObject(@Inject({ qualifier: SERVICE_INHERIT_2 }) svc: ServiceInherit) {
    return new ServiceInherit2(svc.db);
  }
}
