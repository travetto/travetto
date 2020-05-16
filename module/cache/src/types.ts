type OrProm<T> = Promise<T> | T;

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

/**
 * Cache Source contract
 */
export interface CacheSourceType<T extends CacheEntry = CacheEntry> {
  /**
   * Get value for key, returns undefined if missing
   */
  get(key: string): OrProm<T | undefined>;
  /**
   * Determine if value is currently cached
   */
  has(key: string): OrProm<boolean>;
  /**
   * Set cache entry at key
   */
  set(key: string, entry: T): OrProm<CacheEntry>;
  /**
   * Determines if key is expired
   */
  isExpired(key: string): OrProm<boolean>;
  /**
   * Extend expiry time for a key
   */
  touch(key: string, expiresAt: number): OrProm<boolean>;
  /**
   * Remove key from cache
   */
  delete(key: string): OrProm<boolean>;
  /**
   * Get list of keys
   */
  keys(): OrProm<Iterable<string>>;
  /**
   * Clear entire cache
   */
  clear?(): OrProm<void> | void;
  /**
   * Post construction hook, used for async initliazations
   */
  postConstruct?(): OrProm<void>;
  /**
   * How to compute the key from input params
   */
  computeKey(params: any): OrProm<string>;

  /**
   * Get item and verify expiry time against the provided config
   */
  getAndCheckAge(config: CacheConfig, key: string): OrProm<any>;
  /**
   * Set item and mark expiry time with the provided config
   */
  setWithAge(config: CacheConfig, entry: Partial<T> & { data: any, key: string }): OrProm<CacheEntry>;
  /**
   * Get optional value as defined by config
   */
  getOptional(config: CacheConfig, key: string): OrProm<CacheEntry | undefined>;
}