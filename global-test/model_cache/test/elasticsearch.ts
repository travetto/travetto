
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/test/service';

import { ElasticsearchModelService, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchCacheSuite extends CacheServiceSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
