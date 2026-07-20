import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { PostgresModelConfig, PostgresModelService } from '@travetto/model-postgres';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static modelProviderExpiry(svc: PostgresModelService): ModelExpirySupport {
    return svc;
  }
  @InjectableFactory(CacheModelSymbol)
  static modelProviderService(svc: PostgresModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class PostgreSQLCacheSuite extends CacheServiceSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
