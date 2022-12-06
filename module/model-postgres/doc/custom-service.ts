import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';
import { PostgresDialect } from '@travetto/model-postgres';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, conf: SQLModelConfig) {
    return new SQLModelService(ctx, conf, new PostgresDialect(ctx, conf));
  }
}
