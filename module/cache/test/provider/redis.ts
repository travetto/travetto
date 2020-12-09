// @file-if @travetto/model-redis

import { InjectableFactory } from '@travetto/di';
import { RedisModelService, RedisModelConfig } from '@travetto/model-redis';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '../../src/service';
import { CacheTestSuite } from '../cache';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisCacheSuite extends CacheTestSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}