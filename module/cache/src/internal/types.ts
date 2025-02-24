import { CacheConfig, CoreCacheConfig } from '../types.ts';

export const CacheConfigSymbol = Symbol.for('@travetto/cache:cache');
export const EvictConfigSymbol = Symbol.for('@travetto/cache:evict');

export interface CacheAware {
  [CacheConfigSymbol]?: Record<string, CacheConfig>;
  [EvictConfigSymbol]?: Record<string, CoreCacheConfig>;
}