import { InjectableFactory } from '@travetto/di';
import { PostgresModelConfig, PostgresModelService } from '@travetto/model-postgres';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(svc: PostgresModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class PostgreSQLAuthModelServiceSuite extends AuthModelServiceSuite<PostgresModelService> {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
