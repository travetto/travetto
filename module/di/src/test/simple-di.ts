import { Injectable, Inject } from '../lib/decorator/injectable';
import { DbConfig } from './config';
import { Registry } from '../lib/service';

@Injectable()
class Database {
  constructor( @Inject('a') dbConfig: DbConfig) {
    console.log("Creating database", dbConfig);
  }
}

@Injectable()
class Service {
  constructor(db: Database) {
    console.log("Creating service", db);
  }
}


Registry.getInstance(Service)