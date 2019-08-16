import { CacheEntry, LocalCacheStore } from './types';

export class MemoryCacheStore extends LocalCacheStore {

  store = new Map<string, CacheEntry>();

  reset() {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key)! as CacheEntry;
    return entry && this.postLoad(entry);
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    this.cull();

    entry = await this.prePersist(entry);
    this.store.set(key, entry);
    return this.postLoad(entry).data;
  }

  touch(key: string, expiresAt: number): boolean {
    this.store.get(key)!.expiresAt = expiresAt;
    return true;
  }

  evict(key: string): boolean {
    return this.store.delete(key);
  }

  getAllKeys() {
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