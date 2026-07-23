import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { SqliteModelConfig, SqliteModelService } from '@travetto/model-sqlite';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static modelProviderExpiry(svc: SqliteModelService): ModelExpirySupport {
    return svc;
  }
  @InjectableFactory(CacheModelSymbol)
  static modelProviderService(svc: SqliteModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class SqliteCacheSuite extends CacheServiceSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
