// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';

import { DynamoDBModelService, DynamoDBModelConfig } from '..';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamoDBCacheSuite extends CacheServiceSuite {
  baseLatency = 100;

  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}