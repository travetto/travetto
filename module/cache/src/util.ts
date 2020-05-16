import { CacheSourceType, CacheConfig, CoreCacheConfig } from './types';

/**
 * Standard cache utilities
 */
export class CacheUtil {
  /**
   * Generate key given config, cache source and input params
   */
  static generateKey(config: CoreCacheConfig, cache: CacheSourceType, params: any[]) {
    const input = config.params?.(params) ?? params;
    const keyParams = config.key?.(...input) ?? input;
    return `${config.keySpace!}♯${cache.computeKey(keyParams)}`;
  }

  /**
   * Cache the function output
   *
   * @param config Cache configuration
   * @param cache Actual cache source
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params input parameters
   */
  static async cache(config: CacheConfig, cache: CacheSourceType, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, cache, params);

    let res = await cache.getOptional(config, key);

    if (res === undefined) {
      let data = await fn.apply(target, params);
      if (config.serialize) {
        data = config.serialize(data);
      }
      res = (await cache.setWithAge(config, { key, data })).data;
    }

    if (config.reinstate) { // Reinstate result value if needed
      res = config.reinstate(res);
    }

    return res;
  }

  /**
   * Evict value from cache
   *
   * @param config Cache config
   * @param cache  Cache store
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params Input params to the function
   */
  static async evict(config: CacheConfig, cache: CacheSourceType, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, cache, params);
    const val = await fn.apply(target, params);
    await cache.delete(key);
    return val;
  }
}