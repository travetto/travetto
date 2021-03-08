// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelSym, ModelSessionProvider } from '@travetto/rest-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { SQLModelConfig } from '../src/config';
import { MySQLDialect } from '../src/dialect/mysql/dialect';
import { SQLModelService } from '../src/service';

class Config {
  @InjectableFactory({ primary: true })
  static provider() {
    return new ModelSessionProvider();
  }
  @InjectableFactory(SessionModelSym)
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SQLModelService(ctx, config, new MySQLDialect(ctx, config));
  }
}

@Suite()
@ModelSuite()
export class MysqlRestSesisonServerSuite extends RestSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}