const CacheConfig: unique symbol = Symbol.for('@travetto/cache:cache');
const EvictConfig: unique symbol = Symbol.for('@travetto/cache:evict');
const Model: unique symbol = Symbol.for('@travetto/cache:model');

export const CacheSymbols = {
  CacheConfig,
  EvictConfig,
  Model
} as const;