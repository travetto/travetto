import { CacheConfig, CoreCacheConfig } from '../types';

export const CacheConfigⲐ = Symbol.for('@travetto/cache:cache');
export const EvictConfigⲐ = Symbol.for('@travetto/cache:evict');

export interface CacheAware {
  [CacheConfigⲐ]?: Record<string, CacheConfig>;
  [EvictConfigⲐ]?: Record<string, CoreCacheConfig>;
}