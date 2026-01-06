import type { TypedFunction } from '@travetto/runtime';

export const CacheConfigSymbol: unique symbol = Symbol.for('@travetto/cache:cache');
export const EvictConfigSymbol: unique symbol = Symbol.for('@travetto/cache:evict');
export const CacheModelSymbol: unique symbol = Symbol.for('@travetto/cache:model');

/**
 * A minimal config for a cache operation
 */
export interface CoreCacheConfig {
  /**
   * A method for converting the input params into the final set of param keys
   */
  params?: TypedFunction<unknown[]>;
  /**
   * Takes in a set of params and produce the unique cache key
   */
  key?: TypedFunction<string>;
  /**
   * A namespace for the specific cache operation
   */
  keySpace?: string;

  /**
   * How to reconstitute the cached value after JSON parsing
   */
  reinstate?: (input: unknown) => unknown;
}

/**
 * The full config for a cache operation
 */
export interface CacheConfig extends CoreCacheConfig {
  /**
   * The max age a cacheable item is allowed to reach
   */
  maxAge?: number;
  /**
   * Whether or not to extends the TTL on access
   */
  extendOnAccess?: boolean;
}

/**
 * Describes a class as being cache aware or not
 */
export interface CacheAware {
  [CacheConfigSymbol]?: Record<string, CacheConfig>;
  [EvictConfigSymbol]?: Record<string, CoreCacheConfig>;
}

