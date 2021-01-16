/**
 * A minimal config for a cache operation
 */
export interface CoreCacheConfig {
  /**
   * A method for converting the input params into the final set of param keys
   */
  params?: (...params: any[]) => unknown[];
  /**
   * Takes in a set of params and produce the unique cache key
   */
  key?: (...params: any[]) => string;
  /**
   * A namespace for the specific cache operation
   */
  keySpace?: string;

  /**
   * How to reconstitute the cached value after JSON.parse
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