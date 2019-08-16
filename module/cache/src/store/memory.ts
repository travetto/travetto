import { SystemUtil } from '@travetto/base';

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
    let entry = this.store.get(key)! as CacheEntry;
    if (entry) {
      entry = { ...entry }; // Clone
      if (entry.stream) {
        entry.data = SystemUtil.toReadable(Buffer.from(entry.data, 'base64'));
      } else {
        entry.data = JSON.parse(entry.data);
      }
      return entry;
    } else {
      return;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    this.cull();

    let value = entry.data;
    if (this.isStream(value)) {
      entry.data = (await SystemUtil.toBuffer(value as NodeJS.ReadableStream)).toString('base64');
      value = SystemUtil.toReadable(entry.data); // Refill stream
      entry.stream = true;
    } else {
      entry.data = JSON.stringify(value);
      value = JSON.parse(entry.data); // Decouple
    }
    this.store.set(key, entry);
    return value;
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