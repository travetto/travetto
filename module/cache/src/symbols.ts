const CacheConfig = Symbol.for('@travetto/cache:cache');
const EvictConfig = Symbol.for('@travetto/cache:evict');
const Model = Symbol.for('@travetto/cache:model');

export const CacheSymbols = {
  CacheConfig,
  EvictConfig,
  Model
} as const;