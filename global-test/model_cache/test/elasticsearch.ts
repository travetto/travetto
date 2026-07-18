import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
class ElasticsearchCacheSuite extends CacheServiceSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
