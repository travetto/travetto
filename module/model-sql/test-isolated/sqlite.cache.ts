// @file-if @travetto/cache
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelService, SQLModelConfig } from '..';
import { SqliteDialect } from '../src/dialect/sqlite/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
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
export class SqliteCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}