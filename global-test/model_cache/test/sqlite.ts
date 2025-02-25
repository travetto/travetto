import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
  @InjectableFactory(CacheModelSymbol)
  static modelProviderExpiry(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
  @InjectableFactory(CacheModelSymbol)
  static modelProviderService(svc: SQLModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
export class SqliteCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
