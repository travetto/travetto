// @file-if @travetto/cache
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelService, SQLModelConfig } from '..';
import { PostgreSQLDialect } from '../src/dialect/postgresql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
  @InjectableFactory(CacheModelⲐ)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
  @InjectableFactory(CacheModelⲐ)
  static modelProviderDeux(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
export class PostgresqlCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}