import { Injectable, Inject } from '../src/decorator/injectable';
import { DbConfig, AltConfig } from './config';
import { DependencyRegistry } from '../src/service';

@Injectable()
class Database {
  @Inject({ name: 'a' }) dbConfig: DbConfig;
  @Inject({ optional: true }) altConfig: AltConfig;

  postConstruct() {
    console.log('Creating database', this.dbConfig.getUrl());
  }

  query() {
    console.log('Getting stuff', this.dbConfig.getUrl());
  }
}

@Injectable()
class Service {

  constructor(private db: Database) {
    console.log('Creating service', db);
  }

  doWork() {
    this.db.query();
  }
}


async function run() {
  let inst = await DependencyRegistry.getInstance(Service);
  inst.doWork();
}

setInterval(() => run(), 1000);