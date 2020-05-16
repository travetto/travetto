// @file-if redis
import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { RedisCacheSource } from '../src/extension/redis';

@Suite()
export class RedisCacheSuite extends FullCacheSuite {
  source = RedisCacheSource;
}