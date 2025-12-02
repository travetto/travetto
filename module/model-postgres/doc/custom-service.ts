import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';
import { PostgreSQLDialect } from '@travetto/model-postgres';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SQLModelService(ctx, config, new PostgreSQLDialect(ctx, config));
  }
}
