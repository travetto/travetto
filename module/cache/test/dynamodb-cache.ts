// @file-if @aws-sdk/client-dynamodb
import { Suite } from '@travetto/test';
import { Util } from '@travetto/base';
import { FullCacheSuite } from './cache';
import { DynamodbCacheSource } from '../src/extension/dynamodb';

@Suite()
export class DynamodbCacheSuite extends FullCacheSuite {
  source = DynamodbCacheSource;
  baseLatency = 30;

  getInstance() {
    return new DynamodbCacheSource({
      endpoint: 'http://localhost:8000'
    }, `cache_${Util.uuid()}`);
  }
}