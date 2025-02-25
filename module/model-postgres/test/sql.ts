import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig } from '@travetto/model-sql/src/config.ts';
import { Suite } from '@travetto/test';
import { SQLModelService } from '@travetto/model-sql';
import { BaseSQLTest } from '@travetto/model-sql/support/test/query.ts';

import { PostgreSQLDialect } from '../src/dialect.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@Suite()
export class PostgreSQLQueryTest extends BaseSQLTest {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}