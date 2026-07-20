import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import { MysqlModelConfig, MysqlModelService } from '@travetto/model-mysql';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static modelProviderExpiry(svc: MysqlModelService): ModelExpirySupport {
    return svc;
  }
  @InjectableFactory(CacheModelSymbol)
  static modelProviderService(svc: MysqlModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class MySQLCacheSuite extends CacheServiceSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
