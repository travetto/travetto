import { CacheStore } from './store/types';
import { CacheConfig, CacheError } from './types';

class $CacheManager {

  async get(cache: CacheStore, config: CacheConfig, key: string): Promise<any> {
    const entry = await cache.get(key);
    const now = Date.now();
    if (entry === undefined) { // Missing
      throw new CacheError('Key not found', 'notfound');
    }
    if (entry.expiresAt && entry.expiresAt < now) {
      await this.evict(cache, key);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (config.extendOnAccess && entry.maxAge && entry.expiresAt) {
      const delta = entry.expiresAt - now;
      const threshold = entry.maxAge / 2;
      if (delta < threshold) {
        await cache.touch(key, Date.now() + entry.maxAge); // Do not wait
      }
    }

    return entry.data;
  }

  async has(cache: CacheStore, key: string) {
    return cache.has(key);
  }

  set(cache: CacheStore, config: CacheConfig, key: string, value: any): Promise<void> | void {
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

  async getOptional(cache: CacheStore, config: CacheConfig, key: string) {
    let res: any;
    const has = await this.has(cache, key);

    if (has) {
      try {
        res = await this.get(cache, config, key);
      } catch (err) {
        if (!(err instanceof CacheError)) {
          throw err;
        }
      }
    }

    return res;
  }
}

export const CacheManager = new $CacheManager();