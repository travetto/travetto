import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelService, type SQLModelConfig } from '@travetto/model-sql';
import { MySQLDialect } from '@travetto/model-mysql';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SQLModelService(ctx, config, new MySQLDialect(ctx, config));
  }
}
