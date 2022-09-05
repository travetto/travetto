import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, conf: SQLModelConfig) {
    return new SQLModelService(ctx, conf, new SqliteDialect(ctx, conf));
  }
}
