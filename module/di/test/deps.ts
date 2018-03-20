import { Injectable, Inject } from '../src';
import { DbConfig, AltConfig } from './config';

@Injectable()
export class Database {
  @Inject() dbConfig!: DbConfig<any, any>;
  @Inject({ optional: true }) altConfig!: AltConfig;

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

}