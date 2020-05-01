import { CullableCacheStore } from './cullable';
import { CacheEntry } from '../types';
import { CacheStoreUtil } from './util';

/**
 * A cache store backed by a JS Map
 */
export class MemoryCacheStore<T extends CacheEntry = CacheEntry> extends CullableCacheStore<T> {

  store = new Map<string, { expiresAt?: number, entry: string }>();

  clear() {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry) {
      return {
        ...CacheStoreUtil.readAsSafeJSON(entry.entry),
        expiresAt: entry.expiresAt
      };
    }
  }

  async set(key: string, entry: T): Promise<any> {
    this.cull();

    const cloned = CacheStoreUtil.storeAsSafeJSON(entry);

    this.store.set(key, { entry: cloned, expiresAt: entry.expiresAt });

    return CacheStoreUtil.readAsSafeJSON(cloned);
  }

  touch(key: string, expiresAt: number): boolean {
    this.store.get(key)!.expiresAt = expiresAt;
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  keys() {
    return this.store.keys();
  }

  isExpired(key: string) {
    const entry = this.store.get(key);
    if (entry) {
      return !!entry.expiresAt && entry.expiresAt! < Date.now();
    }
    return false;
  }
}