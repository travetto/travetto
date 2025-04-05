import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';
import { NodeWebServerSupport } from '@travetto/web-node/support/test/server-support.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
  @InjectableFactory(SessionModelSymbol)
  static modelProvider(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class SqliteAuthSessionServerSuite extends AuthSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
  type = NodeWebServerSupport;
}
