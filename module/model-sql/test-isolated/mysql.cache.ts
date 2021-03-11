// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';
import { ModelExpirySupport } from '@travetto/model/src/service/expiry';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelService, SQLModelConfig } from '..';
import { MySQLDialect } from '../src/dialect/mysql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
  @InjectableFactory(CacheModelSym)
  static modelProvider(svc: SQLModelService) {
    return svc;
  }
  @InjectableFactory(CacheModelSym)
  static modelProviderDeux(svc: SQLModelService): ModelExpirySupport {
    return svc;
  }
}

@Suite()
@WithSuiteContext()
export class MysqlCacheSuite extends CacheServiceSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}