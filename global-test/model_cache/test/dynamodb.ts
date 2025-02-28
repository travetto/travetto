
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';
import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

import { CacheServiceSuite } from '@travetto/cache/support/test/service';

class Config {
  @InjectableFactory(CacheSymbols.Model)
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
