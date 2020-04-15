import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { FileCacheStore } from '../src/store/file';

@Suite()
export class FileCacheSuite extends FullCacheSuite {
  store = FileCacheStore;
}