import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { MysqlModelConfig, MysqlModelService } from '@travetto/model-mysql';
import { Suite } from '@travetto/test';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static modelProvider(svc: MysqlModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
class MysqlAuthSessionServerSuite extends AuthSessionServerSuite<MysqlModelService> {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
