// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';

import { ElasticsearchModelService, ElasticsearchModelConfig } from '..';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchCacheSuite extends CacheServiceSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}