import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model';
import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';
import { MySQLDialect } from '@travetto/model-mysql';

import { CacheServiceSuite } from '@travetto/cache/support/test/service';
import { WithSuiteContext } from '@travetto/context/support/test/context';


class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
  @InjectableFactory(CacheSymbols.Model)
  static modelProviderExpiry(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
  @InjectableFactory(CacheSymbols.Model)
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
