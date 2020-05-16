import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { MemoryCacheSource } from '../src/source/memory';

@Suite()
export class MemoryCacheSuite extends FullCacheSuite {
  source = MemoryCacheSource;
}