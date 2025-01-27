import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server';
import { SessionModelSymbol } from '@travetto/auth-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/support/test/suite';
import { ModelExpirySupport } from '@travetto/model';
import { SQLModelConfig, SQLModelService, SQLDialect } from '@travetto/model-sql';

import { MySQLDialect } from '@travetto/model-mysql';

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
@ModelSuite()
export class MysqlAuthSessionServerSuite extends AuthSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
