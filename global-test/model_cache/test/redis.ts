import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
class RedisCacheSuite extends CacheServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
