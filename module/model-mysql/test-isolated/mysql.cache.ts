// @file-if @travetto/cache
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { SQLModelService, SQLModelConfig } from '@travetto/model-sql';

import { MySQLDialect } from '../src/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
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

@Suite()
@WithSuiteContext()
export class MysqlCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}