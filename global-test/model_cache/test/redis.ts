
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';
import { RedisModelService, RedisModelConfig } from '@travetto/model-redis';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheSymbols.Model)
  static getModel(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisCacheSuite extends CacheServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
