
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
class DynamoDBCacheSuite extends CacheServiceSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
  baseLatency = 100;
}
