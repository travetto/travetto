import { Injectable } from "../lib/decorator/injectable";

@Injectable()
class DbConfig {
  /// Blah
}

@Injectable()
class Database {
  constructor(dbConfig: DbConfig) {

  }
}

@Injectable()
class Service {
  constructor(db: Database) { }
}