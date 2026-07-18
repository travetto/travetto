import { CacheModelSymbol } from '@travetto/cache';
import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';
import { Suite } from '@travetto/test';

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
class SqliteCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
