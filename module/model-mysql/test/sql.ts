import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { MySQLDialect } from '@travetto/model-mysql';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { BaseSQLTest } from '@travetto/model-sql/support/test/query.ts';

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
