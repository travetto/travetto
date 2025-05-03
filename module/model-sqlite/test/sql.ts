import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';

import { BaseSQLTest } from '@travetto/model-sql/support/test/query.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
}

@Suite()
export class SqliteQueryTest extends BaseSQLTest {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}