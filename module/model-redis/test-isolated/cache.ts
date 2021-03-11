// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';

import { RedisModelService, RedisModelConfig } from '..';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisCacheSuite extends CacheServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}