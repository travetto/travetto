// @with-module @travetto/cache
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { SqliteDialect } from '../src/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
  @InjectableFactory(CacheModelⲐ)
  static modelProviderExpiry(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
  @InjectableFactory(CacheModelⲐ)
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