import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { SqliteModelConfig, SqliteModelService } from '@travetto/model-sqlite';
import { Suite } from '@travetto/test';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static modelProvider(svc: SqliteModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
class SqliteAuthSessionServerSuite extends AuthSessionServerSuite<SqliteModelService> {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
