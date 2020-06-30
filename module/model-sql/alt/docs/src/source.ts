import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { SQLModelConfig } from '../../../src/config';
import { SQLModelSource } from '../../../src/source';
import { MySQLDialect } from '../../../src/dialects/mysql/dialect';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelSource(ctx: AsyncContext, conf: SQLModelConfig) {
    return new SQLModelSource(ctx, conf, new MySQLDialect(ctx, conf));
  }
}
