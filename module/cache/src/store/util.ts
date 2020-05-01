import * as crypto from 'crypto';

import { Util } from '@travetto/base';

/**
 * Simple caching utils
 */
export class CacheStoreUtil {

  /**
   * Compute a cache key off the input params for a function
   */
  static computeKey(params: any) {
    const value = this.storeAsSafeJSON(params, true);
    return crypto.createHash('sha1').update(value).digest('hex');
  }

  /**
   * Convert value to safe JSON for persistance
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
   */
  static readAsSafeJSON(value: string) {
    return value ? JSON.parse(Buffer.from(value, 'base64').toString('utf8')) : value;
  }
}