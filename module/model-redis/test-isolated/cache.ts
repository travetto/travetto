// @with-module @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/service';

import { RedisModelService, RedisModelConfig } from '..';

class Config {
  @InjectableFactory(CacheModelⲐ)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisCacheSuite extends CacheServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}