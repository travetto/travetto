import { Util } from '@travetto/base';

export type ValidCacheFields<T> = {
  [K in keyof T]:
  (T[K] extends CacheStore ? K : never)
}[keyof T];

export interface CacheEntry {
  maxAge?: number;
  expiresAt?: number;
  stream?: boolean;
  issuedAt: number;
  data: any;
  extendOnAccess?: boolean;
}

export abstract class CacheStore {

  computeKey(...params: any[]) {
    return JSON.stringify(params || [], (key, val) => {
      return val instanceof RegExp ? val.source : Util.isFunction(val) ? val.source : val;
    });
  }

  isStream(value: any): value is NodeJS.ReadStream {
    return !Util.isSimple(value) && 'pipe' in value;
  }

  abstract get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  abstract has(key: string): Promise<boolean> | boolean;
  abstract set(key: string, entry: CacheEntry): Promise<any> | any;
  abstract evict(key: string): Promise<boolean> | boolean;
  abstract touch(key: string, age: number): Promise<boolean> | boolean;
  reset?(): Promise<void> | void;
  postConstruct?(): Promise<void> | void;
}

export abstract class LocalCacheStore extends CacheStore {

  lastCullCheck = Date.now();
  cullRate = 10 * 60000; // 10 minutes

  abstract getAllKeys(): Promise<Iterable<string>> | Iterable<string>;
  abstract isExpired(key: string): Promise<boolean> | boolean;

  async cull(force = false) {
    if (!force && (Date.now() - this.lastCullCheck) < this.cullRate) {
      return;
    }

    this.lastCullCheck = Date.now();

    const all = [];
    const keys = await this.getAllKeys();
    for (const key of keys) {
      all.push((async () => {
        try {
          const expired = await this.isExpired(key);
          if (expired) {
            await this.evict(key);
          }
        } catch {
          await this.evict(key);
        }
      })());
    }
    await Promise.all(all);
  }
}