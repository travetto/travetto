import { CullableCacheSource } from './cullable';
import { CacheEntry } from '../types';
import { CacheSourceUtil } from './util';

/**
 * A cache source backed by `Map`
 */
export class MemoryCacheSource<T extends CacheEntry = CacheEntry> extends CullableCacheSource<T> {

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
        ...CacheSourceUtil.readAsSafeJSON(entry.entry),
        expiresAt: entry.expiresAt
      };
    }
  }

  async set(key: string, entry: T): Promise<any> {
    this.cull();

    const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

    this.store.set(key, { entry: cloned, expiresAt: entry.expiresAt });

    return CacheSourceUtil.readAsSafeJSON(cloned);
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