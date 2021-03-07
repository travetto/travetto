// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';

import { SQLModelService, SQLModelConfig } from '..';
import { MySQLDialect } from '../src/dialect/mysql/dialect';

class Config {
  @InjectableFactory(CacheModelSym, { primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@Suite()
export class MysqlCacheSuite extends CacheServiceSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}