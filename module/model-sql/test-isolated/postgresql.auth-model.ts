// @file-if @travetto/auth
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth/test-support/model';
import { AsyncContext } from '@travetto/context';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelConfig, SQLModelService } from '..';
import { PostgreSQLDialect } from '../src/dialect/postgresql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}