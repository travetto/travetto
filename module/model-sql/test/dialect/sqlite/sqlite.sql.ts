import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig } from '@travetto/model-sql/src/config';
import { Suite } from '@travetto/test';
import { SqliteDialect } from '@travetto/model-sql/src/dialect/sqlite/dialect';

import { SQLModelService } from '../../..';
import { BaseSQLTest } from '../../query';

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