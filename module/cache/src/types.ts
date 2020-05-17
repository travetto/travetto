/**
 * A minimal config for a cache operation
 */
export interface CoreCacheConfig {
  /**
   * A method for converting the input params into the final set of param keys
   */
  params?: (...params: any[]) => any[];
  /**
   * Takes in a set of params and produce the unique cache key
   */
  key?: (...params: any[]) => string;
  /**
   * A namespace for the specific cache operation
   */
  keySpace?: string;
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
   * Method for serializing the cacheable value to a string
   */
  serialize?: (output: any) => string;
  /**
   * How to reconstitute the cached value after JSON.parse
   */
  reinstate?: (input: any) => any;
  /**
   * Whether or not to extends the TTL on access
   */
  extendOnAccess?: boolean;
}

/**
 * Record of a cacheable value
 */
export interface CacheEntry {
  /**
   * The unique key
   */
  key: string;
  /**
   * The value's max age
   */
  maxAge?: number;
  /**
   * The current expiry time
   */
  expiresAt?: number;
  /**
   * Whether or not the output value should be streamed
   */
  stream?: boolean;
  /**
   * Time of initial caching
   */
  issuedAt: number;
  /**
   * Cached value
   */
  data: any;
  /**
   * Whether or not entry should be extended on access
   */
  extendOnAccess?: boolean;
}
