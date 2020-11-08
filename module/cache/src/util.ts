import { CacheService } from './source/core';
import { CacheConfig, CoreCacheConfig } from './types';

/**
 * Standard cache utilities
 */
export class CacheUtil {
  /**
   * Generate key given config, cache source and input params
   */
  static generateKey(config: CoreCacheConfig, cache: CacheService<any>, params: any[]) {
    const input = config.params?.(params) ?? params;
    const keyParams = config.key?.(...input) ?? input;
    return `${config.keySpace!}_${cache.computeKey(keyParams)}`;
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
  static async cache(config: CacheConfig, cache: CacheService<any>, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, cache, params);

    let res = await cache.getOptional(config, key);

    if (res === undefined) {
      const data = await fn.apply(target, params);
      res = await cache.setWithAge(config, key, data);
    }

    return res;
  }

  /**
   * Evict value from cache
   *
   * @param config Cache config
   * @param cache  Cache source
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params Input params to the function
   */
  static async evict(config: CacheConfig, cache: CacheService<any>, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, cache, params);
    const val = await fn.apply(target, params);
    await cache.evict(key);
    return val;
  }
}