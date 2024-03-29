
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/test/service';

import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

class Config {
  @InjectableFactory(CacheModelⲐ)
  static getModel(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoCacheSuite extends CacheServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
