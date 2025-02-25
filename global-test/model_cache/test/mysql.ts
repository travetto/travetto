import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/test/service';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model';
import { WithSuiteContext } from '@travetto/context/support/test/context';
import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';

import { MySQLDialect } from '@travetto/model-mysql';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
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

@Suite()
@WithSuiteContext()
export class MysqlCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
