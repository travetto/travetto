// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSym } from '@travetto/auth-model/test-support/service';
import { AsyncContext } from '@travetto/context';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelConfig, SQLModelService } from '..';
import { PostgreSQLDialect } from '../src/dialect/postgresql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

class Init {
  @InjectableFactory(TestModelSvcSym)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}