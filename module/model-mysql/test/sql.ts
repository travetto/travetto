import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';

import { BaseSQLTest } from '@travetto/model-sql/support/test/query';

import { MySQLDialect } from '../src/dialect';

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