// @file-if redis
import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { RedisCacheStore } from '../src/extension/redis.store';

@Suite()
export class RedisCacheSuite extends FullCacheSuite {
  store = RedisCacheStore;
}