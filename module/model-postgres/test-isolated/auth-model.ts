// @with-module @travetto/auth-model
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/test-support/model';
import { AsyncContext } from '@travetto/context';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { PostgreSQLDialect } from '../src/dialect';

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