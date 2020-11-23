import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelConfig } from '../../../src/config';
import { SQLModelService } from '../../../src/service';
import { MySQLDialect } from '../../../src/dialect/mysql/dialect';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(ctx: AsyncContext, conf: SQLModelConfig) {
    return new SQLModelService(ctx, conf, new MySQLDialect(ctx, conf));
  }
}
