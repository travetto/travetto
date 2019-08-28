import * as crypto from 'crypto';

import { Util } from '@travetto/base';

export class CacheStoreUtil {

  static computeKey(params: any) {
    const value = this.storeAsSafeJSON(params, true);
    return crypto.createHash('sha1').update(value).digest('hex');
  }

  static storeAsSafeJSON(value: any, all = false) {
    if (value === null || value === undefined) {
      return value;
    }

    const replacer = all ? (key: string, val: any) => {
      return val && (val instanceof RegExp ? val.source : Util.isFunction(val) ? val.source : val);
    } : undefined;

    return Buffer.from(JSON.stringify(value, replacer), 'utf8').toString('base64');
  }

  static readAsSafeJSON(value: string) {
    return value ? JSON.parse(Buffer.from(value, 'base64').toString('utf8')) : value;
  }
}