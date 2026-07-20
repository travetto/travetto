import { InjectableFactory } from '@travetto/di';
import { SqliteModelConfig, SqliteModelService } from '@travetto/model-sqlite';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(svc: SqliteModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class SqliteAuthModelServiceSuite extends AuthModelServiceSuite<SqliteModelService> {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
