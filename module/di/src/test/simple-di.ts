import { Injectable, Inject } from "../lib/decorator/injectable";

@Injectable()
class DbConfig {
  /// Blah
}

@Injectable()
class Database {
  constructor( @Inject('a') dbConfig: DbConfig) {

  }
}

@Injectable()
class Service {
  constructor(db: Database) { }
}