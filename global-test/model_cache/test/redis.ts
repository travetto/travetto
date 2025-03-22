
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { RedisModelService, RedisModelConfig } from '@travetto/model-redis';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisCacheSuite extends CacheServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
