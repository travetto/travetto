// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';
import { WithSuiteContext } from '@travetto/context/test/lib/suite-context';
import { AsyncContext } from '@travetto/context';

import { MySQLDialect } from '../../src/dialect/mysql/dialect';
import { SQLModelConfig, SQLModelService } from '../..';

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