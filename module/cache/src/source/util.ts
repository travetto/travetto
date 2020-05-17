import * as crypto from 'crypto';

import { Util } from '@travetto/base';

/**
 * Simple caching utils
 */
export class CacheSourceUtil {

  /**
   * Compute a cache key off the input params for a function
   * @params The params to use to compute the key
   */
  static computeKey(params: any) {
    const value = this.storeAsSafeJSON(params, true);
    return crypto.createHash('sha1').update(value).digest('hex');
  }

  /**
   * Convert value to safe JSON for persistance
   * @param value The value to make safe for storage
   * @param all Should functions and regex be included
   */
  static storeAsSafeJSON(value: any, all = false) {
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
  static readAsSafeJSON(value: string) {
    return value ? JSON.parse(Buffer.from(value, 'base64').toString('utf8')) : value;
  }
}