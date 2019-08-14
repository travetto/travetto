import { AppError } from '@travetto/base';

import { CacheStore, ValidCacheFields } from './store/type';

export interface CacheConfig {
  keyFn?: (...args: any[]) => string;
  maxAge?: number;
  storeError?: boolean;
  namespace?: string;
}

class $CacheManager {

  async get(cache: CacheStore, key: string): Promise<any> {
    const entry = await cache.get(key);
    if (entry === undefined) { // Missing
      throw new AppError('Key not found', 'notfound');
    }
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.evict(cache, key);
      throw new AppError('Key not found', 'notfound');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (entry.extendOnAccess && entry.maxAge && (entry.expiresAt! - Date.now()) < entry.maxAge / 2) {
      cache.touch(key);
    }

    return entry.data;
  }

  async has(cache: CacheStore, key: string) {
    const has = cache.has(key);
    if (has) {
      await this.get(cache, key); // Ensure timing
    }
    return has;
  }

  set(cache: CacheStore, key: string, value: any, config: CacheConfig): Promise<void> | void {
    return cache.set(key, {
      issuedAt: Date.now(),
      expiresAt: config.maxAge ? (Date.now() + config.maxAge) : undefined,
      maxAge: config.maxAge,
      data: value
    });
  }

  evict(cache: CacheStore, key: string): Promise<boolean> | boolean {
    return cache.evict(key);
  }

  reset(cache: CacheStore): Promise<void> | void {
    if (cache.reset) {
      return cache.reset();
    }
  }

  decorate<U extends any>(target: U, field: ValidCacheFields<U>, fn: (...args: any[]) => Promise<any>, config: CacheConfig) {
    const mgr = this as $CacheManager;

    if (config.namespace) {
      config.namespace = `${target.constructor.name}.${fn.name}`;
    }

    const caching = async function (this: U, ...args: any[]): Promise<any> {
      const cache = this[field] as any as CacheStore;
      const finalKeyFn = config.keyFn || cache.computeKey;

      const key = `${config.namespace}:${finalKeyFn.apply(undefined, args)}`;
      const has = await mgr.has(cache, key);

      if (!has) {
        try {
          const res = await fn.apply(this, args || []);
          await mgr.set(cache, key, res, config);
          return res;
        } catch (err) {
          if (config.storeError) {
            await mgr.set(cache, key, err, config);
          }
          throw err;
        }
      }
      const out = await mgr.get(cache, key);
      if (out instanceof Error && config.storeError) {
        throw out;
      }
      return out;
    };

    Object.defineProperty(caching, 'name', { value: fn.name });

    return caching;
  }
}

export const CacheManager = new $CacheManager();
