import * as crypto from 'crypto';
import { Util } from '@travetto/base';
import { CacheService } from './service';
import { CacheConfig, CoreCacheConfig } from './types';

/**
 * Standard cache utilities
 */
export class CacheUtil {

  /**
   * Compute a cache key off the input params for a function
   * @params The params to use to compute the key
   */
  static computeKey(params: any) {
    const value = this.toSafeJSON(params, true);
    return crypto.createHash('sha1').update(value).digest('hex');
  }

  /**
   * Convert value to safe JSON for persistance
   * @param value The value to make safe for storage
   * @param all Should functions and regex be included
   */
  static toSafeJSON(value: any, all = false) {
    if (value === null || value === undefined) {
      return value;
    }

    const replacer = all ?
      ((key: string, val: any) => (Util.isFunction(val) || val instanceof RegExp) ? val?.source : val) :
      undefined;

    return Buffer.from(JSON.stringify(value, replacer), 'utf8').toString('base64');
  }

  /**
   * Read safe JSON back into an object
   * @param value The value to read as safe JSON
   */
  static fromSafeJSON(value: string) {
    return value ? JSON.parse(Buffer.from(value, 'base64').toString('utf8')) : value;
  }

  /**
   * Generate key given config, cache source and input params
   */
  static generateKey(config: CoreCacheConfig, params: any[]) {
    const input = config.params?.(params) ?? params;
    const keyParams = config.key?.(...input) ?? input;
    return `${config.keySpace!}_${this.computeKey(keyParams)}`;
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
  static async cache(config: CacheConfig, cache: CacheService, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, params);

    let res = await cache.getOptional(config, key);

    if (res === undefined) {
      const data = await fn.apply(target, params);
      res = await cache.setWithAge(config, key, data);
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
   * @param cache  Cache source
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params Input params to the function
   */
  static async evict(config: CacheConfig, cache: CacheService, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, params);
    const val = await fn.apply(target, params);
    await cache.evict(key);
    return val;
  }
}