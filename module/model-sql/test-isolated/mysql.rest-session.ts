// @file-if @travetto/rest-session
// @file-if @travetto/rest-express
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { AsyncContext } from '@travetto/context';
import { ModelSuite } from '@travetto/model/test-support/suite';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';

import { SQLModelConfig } from '../src/config';
import { MySQLDialect } from '../src/dialect/mysql/dialect';
import { SQLModelService } from '../src/service';
import { SQLDialect } from '../src/dialect/base';

class Config {
  @InjectableFactory({ primary: true })
  static getSqlService(ctx: AsyncContext, config: SQLModelConfig): SQLDialect {
    return new MySQLDialect(ctx, config);
  }
  @InjectableFactory(SessionModelⲐ)
  static modelProvider(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class MysqlRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}