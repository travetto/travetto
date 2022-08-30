// @file-if @travetto/rest-session
// @file-if @travetto/rest-express
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/test-support/suite';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { PostgreSQLDialect } from '../src/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
  @InjectableFactory(SessionModelⲐ)
  static modelProvider(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class PostgreSQLRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}