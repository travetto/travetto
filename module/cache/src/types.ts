type OrProm<T> = T | Promise<T>;
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
 * Cache store
 */
export interface ICacheSource<T extends CacheEntry = CacheEntry> {
  /**
   * Get value for key, returns undefined if missing
   * @param key The key to resolve
   */
  get(key: string): OrProm<T | undefined>;
  /**
   * Determine if value is currently cached
   * @param key The key to resolve
   */
  has(key: string): OrProm<boolean>;
  /**
   * Set cache entry at key
   * @param key The key to set
   * @param entry The entry to store
   */
  set(key: string, entry: T): OrProm<CacheEntry>;
  /**
   * Determines if key is expired
   * @param key The key to check
   */
  isExpired(key: string): OrProm<boolean>;
  /**
   * Extend expiry time for a key
   * @param key The key to touch
   * @param expiresAt The time to push expiration to
   */
  touch(key: string, expiresAt: number): OrProm<boolean>;
  /**
   * Remove key from cache
   * @param key The key to delete
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
   * @param key The params used to compute a key
   */
  computeKey(params: any): string;

  /**
   * Get item and verify expiry time against the provided config
   * @param config The cache config to resolve against
   * @param key The key to check/get
   */
  getAndCheckAge(config: CacheConfig, key: string): Promise<T>;

  /**
   * Set item and mark expiry time with the provided config
   * @param config The cache config to resolve against
   * @param entry The etnry to set
   */
  setWithAge(config: CacheConfig, entry: Partial<T> & { data: any, key: string }): OrProm<T>;

  /**
   * Get optional value as defined by config
   * @param config The cache config to resolve against
   * @param key The key to get
   */
  getOptional(config: CacheConfig, key: string): OrProm<T | undefined>;
}