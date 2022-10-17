import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/support/test/suite';
import { ModelExpirySupport } from '@travetto/model';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { SqliteDialect } from '@travetto/model-sqlite';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
  @InjectableFactory(SessionModelⲐ)
  static modelProvider(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class SqliteRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
