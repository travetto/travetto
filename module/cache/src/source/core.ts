import { CacheEntry, CacheConfig, ICacheSource } from '../types';
import { CacheSourceUtil } from './util';
import { CacheError } from './error';

type OrProm<T> = T | Promise<T>;

/**
 * Cache store
 */
export abstract class CacheSource<T extends CacheEntry = CacheEntry> implements ICacheSource<T> {
  abstract get(key: string): OrProm<T | undefined>;
  abstract has(key: string): OrProm<boolean>;
  abstract set(key: string, entry: T): OrProm<T>;
  abstract isExpired(key: string): OrProm<boolean>;
  abstract touch(key: string, expiresAt: number): OrProm<boolean>;
  abstract delete(key: string): OrProm<boolean>;
  abstract keys(): OrProm<Iterable<string>>;

  clear?(): OrProm<void> | void;
  postConstruct?(): OrProm<void>;

  computeKey(params: any) {
    return CacheSourceUtil.computeKey(params);
  }

  async getAndCheckAge(config: CacheConfig, key: string) {
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

  setWithAge(config: CacheConfig, entry: Partial<T> & { data: any, key: string }) {
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