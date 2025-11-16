import { Inject, Injectable, InjectableFactory } from '@travetto/di';
import { Required } from '@travetto/schema';

import { DbConfig, AltConfig, Empty } from './config.ts';

export abstract class BasePattern { }

@Injectable()
export class SpecificPattern extends BasePattern { }

/**
 * @concrete
 */
export interface BaseType {
  age: number;
}

@Injectable()
export class InterfaceType implements BaseType {
  get age() {
    return 20;
  }
}

@Injectable()
export class Database {

  @Inject()
  dbConfig: DbConfig;

  @Inject()
  @Required(false)
  altConfig: AltConfig;

  postConstruct() {
    console.log('Creating database', { url: this.dbConfig.getUrl() });
  }

  query() {
    console.log('Getting 350', { url: this.dbConfig.getUrl() });
  }
}

@Injectable()
export class Service {

  db: Database;

  constructor(db: Database) {
    this.db = db;
    console.log('Creating service', { database: db.dbConfig });
  }

  doWork() {
    this.db.query();
  }
}

@Injectable()
export class ServiceInherit extends Service {
  name = 'bob';
  age = 30;
  override doWork() {
    this.db.query();
  }
}

export const ServiceInheritSymbol2 = Symbol.for('SVC_I_2');
export const ServiceInheritSymbol3 = Symbol.for('SVC_I_3');

@Injectable(ServiceInheritSymbol2)
export class ServiceInherit2 extends ServiceInherit {
  age = 31;
}

export const CustomServiceInheritSymbol = Symbol.for('Custom');
export const CustomDatabaseSymbol = Symbol.for('CUSTOM DB');
export const CustomEmptySymbol = Symbol.for('Custom EMPTY');
export const CustomInterfaceSymbol = Symbol.for('CustomInterface');

class TestConfig {
  @InjectableFactory(CustomEmptySymbol)
  static getNewDb() {
    const out = new DbConfig();
    return out;
  }

  @InjectableFactory(CustomEmptySymbol)
  static getNewEmpty() {
    const out = new Empty();
    out.age = 20;
    console.log('Custom EMPTY 1', { out });
    return out;
  }

  @InjectableFactory(CustomServiceInheritSymbol)
  static getObject(@Inject(ServiceInheritSymbol2) svc: ServiceInherit) {
    console.log('Did I find service 2', { svc, db: svc?.db });
    const out: ServiceInherit = new ServiceInherit2(svc?.db ?? new Database());
    out.age = 11;
    return out;
  }

  @InjectableFactory(CustomDatabaseSymbol)
  static getCustomDB(@Inject(CustomEmptySymbol) empty: Empty) {
    console.log('Custom EMPTY 2', { empty });
    const config = new DbConfig();
    config.temp = 'any';
    config.empty = empty;

    const db = new Database();
    db.dbConfig = config;
    return db;
  }

  @InjectableFactory(CustomInterfaceSymbol)
  static getIntType() {
    return new InterfaceType();
  }
}

@Injectable()
export class UsableMainClass { }

@Injectable()
export class UsableSubClass extends UsableMainClass { }

@Injectable()
export abstract class UsableSubSubClass extends UsableSubClass { }

@Injectable()
export class UsableSubSubAClass extends UsableSubSubClass { }

@Injectable()
export class UsableSubSubBClass extends UsableSubSubClass { }

export const LooseSymbol = Symbol.for('loose');

@Injectable()
export class LooseResolutionClass {
  name = 'bob';
}

class Config {
  @InjectableFactory(LooseSymbol)
  static getLoose(): LooseResolutionClass {
    return new class extends LooseResolutionClass {
      name = 'george';
    }();
  }
}

@Injectable()
export class SetterInject {
  _prop: LooseResolutionClass;

  @Inject()
  set res(res: LooseResolutionClass) {
    this._prop = res;
  }
}