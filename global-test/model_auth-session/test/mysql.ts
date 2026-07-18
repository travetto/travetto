import { SessionModelSymbol } from '@travetto/auth-session';
import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { MySQLDialect } from '@travetto/model-mysql';
import { type SQLDialect, SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig): SQLDialect {
    return new MySQLDialect(ctx, config);
  }
  @InjectableFactory(SessionModelSymbol)
  static modelProvider(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
class MysqlAuthSessionServerSuite extends AuthSessionServerSuite<SQLModelService> {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
