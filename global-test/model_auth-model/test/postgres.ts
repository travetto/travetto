import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AsyncContext } from '@travetto/context';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { PostgreSQLDialect } from '@travetto/model-postgres';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class PostgreSQLAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
