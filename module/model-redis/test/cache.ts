// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { RedisModelService, RedisModelConfig } from '..';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test/lib/service';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisCacheSuite extends CacheServiceSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}