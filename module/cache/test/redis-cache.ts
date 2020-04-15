import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { RedisCacheStore } from '../extension/redis.store';

@Suite()
export class RedisCacheSuite extends FullCacheSuite {
  store = RedisCacheStore;
}