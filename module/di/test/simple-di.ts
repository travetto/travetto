import { Injectable, Inject } from '../src/decorator/injectable';
import { DbConfig, AltConfig } from './config';
import { DependencyRegistry } from '../src/service';

@Injectable()
class Database {
  @Inject() dbConfig: DbConfig;
  @Inject({ optional: true }) altConfig: AltConfig;

  postConstruct() {
    console.log('Creating database', this.dbConfig.getUrl());
  }

  query() {
    console.log('Getting 300', this.dbConfig.getUrl());
  }
}

@Injectable()
class Service {

  constructor(protected db: Database) {
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


async function run() {
  let inst = await DependencyRegistry.getInstance(ServiceInherit);
  inst.doWork();
}

setTimeout(() => run(), 1000);