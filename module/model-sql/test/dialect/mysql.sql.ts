import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig } from '@travetto/model-sql/src/config';
import { Suite } from '@travetto/test';
import { MySQLDialect } from '@travetto/model-sql/src/dialect/mysql/dialect';

import { SQLModelService } from '../..';
import { BaseSQLTest } from '../query';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@Suite()
export class MySQLQueryTest extends BaseSQLTest {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}