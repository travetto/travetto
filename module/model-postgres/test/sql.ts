import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { PostgreSQLDialect } from '@travetto/model-postgres';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { BaseSQLTest } from '@travetto/model-sql/support/test/query.ts';

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
