import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { MySQLDialect } from '@travetto/model-mysql';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class MySQLAuthModelServiceSuite extends AuthModelServiceSuite<SQLModelService> {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
