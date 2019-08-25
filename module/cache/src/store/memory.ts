import { CullableCacheStore } from './types';
import { CacheEntry } from '../types';

export class MemoryCacheStore<T extends CacheEntry = CacheEntry> extends CullableCacheStore<T> {

  store = new Map<string, T>();

  clear() {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry) {
      return this.postLoad(entry);
    }
  }

  async set(key: string, entry: T): Promise<void> {
    this.cull();

    entry = await this.prePersist(entry);

    this.store.set(key, entry);

    return this.postLoad(entry).data;
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
      return !!entry.maxAge && entry.expiresAt! < Date.now();
    }
    return false;
  }
}