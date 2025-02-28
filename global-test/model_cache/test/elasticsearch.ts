
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';
import { ElasticsearchModelService, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';

import { CacheServiceSuite } from '@travetto/cache/support/test/service';

class Config {
  @InjectableFactory(CacheSymbols.Model)
  static getModel(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchCacheSuite extends CacheServiceSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
