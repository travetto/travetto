import { CacheError, CacheConfig, CacheEntry } from '../types';
import { CacheStoreUtil } from './util';

export type ValidCacheFields<T> = {
  [K in keyof T]:
  (T[K] extends CacheStore ? K : never)
}[keyof T];

export abstract class CacheStore<T extends CacheEntry = CacheEntry> {

  abstract get(key: string): Promise<T | undefined> | T | undefined;
  abstract has(key: string): Promise<boolean> | boolean;
  abstract set(key: string, entry: T): Promise<any> | any;

  abstract isExpired(key: string): Promise<boolean> | boolean;
  abstract touch(key: string, expiresAt: number): Promise<boolean> | boolean;
  abstract delete(key: string): Promise<boolean> | boolean;
  abstract keys(): Promise<Iterable<string>> | Iterable<string>;

  clear?(): Promise<void> | void;

  postConstruct?(): Promise<void> | void;

  computeKey(params: any) {
    return CacheStoreUtil.computeKey(params);
  }

  prePersist(entry: T) {
    return CacheStoreUtil.serialize(entry);
  }

  postLoad(entry: T): T {
    return CacheStoreUtil.deserialize(entry);
  }

  async getAndCheckAge(config: CacheConfig, key: string): Promise<any> {
    const entry = await this.get(key);
    const now = Date.now();
    if (entry === undefined) { // Missing
      throw new CacheError('Key not found', 'notfound');
    }
    if (entry.expiresAt && entry.expiresAt < now) {
      await this.delete(key);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (config.extendOnAccess && entry.maxAge && entry.expiresAt) {
      const delta = entry.expiresAt - now;
      const threshold = entry.maxAge / 2;
      if (delta < threshold) {
        await this.touch(key, Date.now() + entry.maxAge); // Do not wait
      }
    }

    return entry.data;
  }

  setWithAge(config: CacheConfig, entry: Partial<T> & { data: any, key: string }): Promise<void> | void {
    return this.set(entry.key, {
      ...entry,
      issuedAt: Date.now(),
      expiresAt: config.maxAge ? (Date.now() + config.maxAge) : undefined,
      maxAge: config.maxAge,
    } as T);
  }

  async getOptional(config: CacheConfig, key: string) {
    let res: any;
    const has = await this.has(key);

    if (has) {
      try {
        res = await this.getAndCheckAge(config, key);
      } catch (err) {
        if (!(err instanceof CacheError)) {
          throw err;
        }
      }
    }
    return res;
  }
}

export abstract class CullableCacheStore<T extends CacheEntry = CacheEntry> extends CacheStore<T> {

  lastCullCheck = Date.now();
  cullRate = 10 * 60000; // 10 minutes

  async cull(force = false) {
    if (!force && (Date.now() - this.lastCullCheck) < this.cullRate) {
      return;
    }

    this.lastCullCheck = Date.now();

    const all = [];
    const keys = await this.keys();
    for (const key of keys) {
      all.push((async () => {
        try {
          const expired = await this.isExpired(key);
          if (expired) {
            await this.delete(key);
          }
        } catch {
          await this.delete(key);
        }
      })());
    }
    await Promise.all(all);
  }
}