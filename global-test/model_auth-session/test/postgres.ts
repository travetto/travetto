import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import type { AsyncContext } from '@travetto/context';
import type { ModelExpirySupport } from '@travetto/model';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { PostgreSQLDialect } from '@travetto/model-postgres';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
  @InjectableFactory(SessionModelSymbol)
  static modelProvider(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
@ModelSuite()
class PostgreSQLAuthSessionServerSuite extends AuthSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
