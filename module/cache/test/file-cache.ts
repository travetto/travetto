import { Suite } from '@travetto/test';
import { FullCacheSuite } from './cache';
import { FileCacheSource } from '../src/source/file';

@Suite()
export class FileCacheSuite extends FullCacheSuite {
  source = FileCacheSource;
}