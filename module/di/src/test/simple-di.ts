import { Injectable, Inject } from "../lib/decorator/injectable";
import { DbConfig } from "./config";

@Injectable()
class Database {
  constructor( @Inject('a') dbConfig: DbConfig) {

  }
}

@Injectable()
class Service {
  constructor(db: Database) { }
}