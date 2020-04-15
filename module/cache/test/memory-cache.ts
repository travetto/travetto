import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { MemoryCacheStore } from '../src/store/memory';

@Suite()
export class MemoryCacheSuite extends FullCacheSuite {
  store = MemoryCacheStore;
}