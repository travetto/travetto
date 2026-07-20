import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { PostgresModelConfig, PostgresModelService } from '@travetto/model-postgres';
import { Suite } from '@travetto/test';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static modelProvider(svc: PostgresModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
class PostgreSQLAuthSessionServerSuite extends AuthSessionServerSuite<PostgresModelService> {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
