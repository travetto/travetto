
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/test/service';

import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamoDBCacheSuite extends CacheServiceSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
  baseLatency = 100;
}
