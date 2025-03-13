
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';
import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheSymbols.Model)
  static getModel(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoCacheSuite extends CacheServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
