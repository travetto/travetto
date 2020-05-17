import { CacheEntry, CacheConfig } from '../types';
import { CacheSourceUtil } from './util';
import { CacheError } from './error';

type OrProm<T> = T | Promise<T>;

/**
 * Cache store
 */
export abstract class CacheSource<T extends CacheEntry = CacheEntry> {
  /**
    * Get value for key, returns undefined if missing
    * @param key The key to resolve
    */
  abstract get(key: string): OrProm<T | undefined>;
  /**
   * Determine if value is currently cached
   * @param key The key to resolve
   */
  abstract has(key: string): OrProm<boolean>;
  /**
   * Set cache entry at key
   * @param key The key to set
   * @param entry The entry to store
   */
  abstract set(key: string, entry: T): OrProm<CacheEntry>;
  /**
   * Determines if key is expired
   * @param key The key to check
   */
  abstract isExpired(key: string): OrProm<boolean>;
  /**
   * Extend expiry time for a key
   * @param key The key to touch
   * @param expiresAt The time to push expiration to
   */
  abstract touch(key: string, expiresAt: number): OrProm<boolean>;
  /**
   * Remove key from cache
   * @param key The key to delete
   */
  abstract delete(key: string): OrProm<boolean>;
  /**
   * Get list of keys
   */
  abstract keys(): OrProm<Iterable<string>>;
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
  computeKey(params: any) {
    return CacheSourceUtil.computeKey(params);
  }

  /**
   * Get item and verify expiry time against the provided config
   * @param config The cache config to resolve against
   * @param key The key to check/get
   */
  async getAndCheckAge(config: CacheConfig, key: string) {
    const entry = await this.get(key);
    const now = Date.now();
    if (entry === undefined) { // Missing
      throw new CacheError('Key not found', 'notfound');
    }
    if (entry.expiresAt && entry.expiresAt < now) {
      await this.delete(key);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (config.extendOnAccess && entry.maxAge && entry.expiresAt) {
      const delta = entry.expiresAt - now;
      const threshold = entry.maxAge / 2;
      if (delta < threshold) {
        await this.touch(key, Date.now() + entry.maxAge); // Do not wait
      }
    }

    return entry.data;
  }

  /**
   * Set item and mark expiry time with the provided config
   * @param config The cache config to resolve against
   * @param entry The etnry to set
   */
  setWithAge(config: CacheConfig, entry: Partial<T> & { data: any, key: string }) {
    return this.set(entry.key, {
      ...entry,
      issuedAt: Date.now(),
      expiresAt: config.maxAge ? (Date.now() + config.maxAge) : undefined,
      maxAge: config.maxAge,
    } as T);
  }

  /**
   * Get optional value as defined by config
   * @param config The cache config to resolve against
   * @param key The key to get
   */
  async getOptional(config: CacheConfig, key: string) {
    let res: any;
    const has = await this.has(key);

    if (has) {
      try {
        res = await this.getAndCheckAge(config, key);
      } catch (err) {
        if (!(err instanceof CacheError)) {
          throw err;
        }
      }
    }
    return res;
  }
}