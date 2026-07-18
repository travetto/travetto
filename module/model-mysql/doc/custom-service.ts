import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { MySQLDialect } from '@travetto/model-mysql';
import { type SQLModelConfig, SQLModelService } from '@travetto/model-sql';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, config: SQLModelConfig) {
    return new SQLModelService(ctx, config, new MySQLDialect(ctx, config));
  }
}
