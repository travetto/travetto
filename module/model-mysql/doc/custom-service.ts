import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';
import { MySQLDialect } from '@travetto/model-mysql';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, conf: SQLModelConfig) {
    return new SQLModelService(ctx, conf, new MySQLDialect(ctx, conf));
  }
}
