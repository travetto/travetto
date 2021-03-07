import * as crypto from 'crypto';

import { JSONUtil } from '@travetto/boot/src/internal/json';
import { Util } from '@travetto/base';
import { CoreCacheConfig } from './types';

/**
 * Standard cache utilities
 */
export class CacheUtil {

  /**
   * Convert value to safe JSON for persistance
   * @param value The value to make safe for storage
   * @param all Should functions and regex be included
   */
  static toSafeJSON(value: unknown, all = false) {
    const replacer = all ?
      ((key: string, val: unknown) => (Util.isFunction(val) || val instanceof RegExp) ? (val as RegExp)?.source : val) :
      undefined;

    return Buffer.from(JSON.stringify(value, replacer)).toString('base64');
  }

  /**
   * Read safe JSON back into an object
   * @param value The value to read as safe JSON
   */
  static fromSafeJSON(value: string) {
    return JSONUtil.parse(Buffer.from(value, 'base64').toString('utf8'));
  }

  /**
   * Generate key given config, cache source and input params
   */
  static generateKey(config: CoreCacheConfig, params: unknown[]) {
    const input = config.params?.(params) ?? params;
    const keyParams = config.key?.(...input) ?? input;
    const key = `${config.keySpace!}_${this.toSafeJSON(keyParams)}`;
    return crypto.createHash('sha1').update(key).digest('hex').substring(0, 32); // Force to uuid
  }
}