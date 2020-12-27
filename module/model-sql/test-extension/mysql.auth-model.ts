// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test-support/service';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { AsyncContext } from '@travetto/context';

import { SQLModelConfig, SQLModelService } from '..';
import { MySQLDialect } from '../src/dialect/mysql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

class Init {
  @InjectableFactory(AuthModelSymbol)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
export class MySQLAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}