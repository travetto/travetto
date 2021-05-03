import { CacheConfig, CoreCacheConfig } from '../types';

export const CacheConfigⲐ = Symbol.for('@trv:cache/cache');
export const EvictConfigⲐ = Symbol.for('@trv:cache/evict');

export interface CacheAware {
  [CacheConfigⲐ]?: Record<string, CacheConfig>;
  [EvictConfigⲐ]?: Record<string, CoreCacheConfig>;
}