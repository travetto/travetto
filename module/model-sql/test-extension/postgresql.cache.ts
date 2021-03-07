// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';
import { AsyncContext } from '@travetto/context';

import { SQLModelService, SQLModelConfig } from '..';
import { PostgreSQLDialect } from '../src/dialect/postgresql/dialect';

class Config {
  @InjectableFactory(CacheModelSym, { primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@Suite()
export class PostgresqlCacheSuite extends CacheServiceSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}