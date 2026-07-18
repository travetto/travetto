import { CacheModelSymbol } from '@travetto/cache';
import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { PostgreSQLDialect } from '@travetto/model-postgres';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
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
class PostgresqlCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
