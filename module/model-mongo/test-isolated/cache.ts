// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';

import { MongoModelService, MongoModelConfig } from '..';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoCacheSuite extends CacheServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}