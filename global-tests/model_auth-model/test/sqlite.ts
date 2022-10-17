import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/support/test.model';
import { AsyncContext } from '@travetto/context';
import { WithSuiteContext } from '@travetto/context/support/test.context';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { SqliteDialect } from '@travetto/model-sqlite';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
export class SqliteAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
