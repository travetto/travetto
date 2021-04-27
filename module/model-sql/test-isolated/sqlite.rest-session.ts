// @file-if @travetto/rest-session
// @file-if @travetto/rest-express
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { SQLModelConfig } from '../src/config';
import { SqliteDialect } from '../src/dialect/sqlite/dialect';
import { SQLModelService } from '../src/service';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
  @InjectableFactory(SessionModelⲐ)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class SqliteRestSesisonServerSuite extends RestSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}