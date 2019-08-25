import * as crypto from 'crypto';

import { SystemUtil, Util } from '@travetto/base';
import { CacheEntry } from '../types';

export class CacheStoreUtil {
  static isStream(value: any): value is NodeJS.ReadStream {
    return value && !Util.isSimple(value) && 'pipe' in value;
  }

  static computeKey(params: any) {
    const value = this.storeAsSafeJSON(params, true);
    return crypto.createHash('sha1').update(value).digest('hex');
  }

  static storeAsSafeJSON(value: any, all = false) {
    const replacer = all ? (key: string, val: any) => {
      return val instanceof RegExp ? val.source : Util.isFunction(val) ? val.source : val;
    } : undefined;

    return Buffer.from(JSON.stringify(value, replacer), 'utf8').toString('base64');
  }

  static readAsSafeJSON(value: string) {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  }

  static deserialize<T extends CacheEntry = CacheEntry>(entry: T): T {
    const data = entry.data;
    if (entry.stream) {
      return {
        ...entry,
        stream: true,
        data: SystemUtil.toReadable(data)
      };
    } else {
      return {
        ...entry,
        data: data === null || data === undefined ? data : this.readAsSafeJSON(data)
      };
    }
  }

  static async serialize<T extends CacheEntry = CacheEntry>(entry: T): Promise<T> {
    if (this.isStream(entry.data)) {
      return {
        ...entry,
        stream: true,
        data: (await SystemUtil.toBuffer(entry.data)).toString('base64')
      };
    } else {
      return {
        ...entry,
        data: this.storeAsSafeJSON(entry.data)
      };
    }
  }
}