// @file-if @travetto/model-dynamodb

import { InjectableFactory } from '@travetto/di';
import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '../../src/service';
import { CacheTestSuite } from '../cache';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamodbCacheSuite extends CacheTestSuite {
  baseLatency = 100;

  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}