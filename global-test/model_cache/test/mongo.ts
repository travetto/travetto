import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoCacheSuite extends CacheServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
