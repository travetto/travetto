// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelSym, ModelSessionProvider } from '@travetto/rest-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { SQLModelConfig } from '../src/config';
import { PostgreSQLDialect } from '../src/dialect/postgresql/dialect';
import { SQLModelService } from '../src/service';

class Config {
  @InjectableFactory({ primary: true })
  static provider() {
    return new ModelSessionProvider();
  }
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
  @InjectableFactory(SessionModelSym)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class PostgreSQLRestSesisonServerSuite extends RestSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}