import { SystemUtil } from '@travetto/base';

import { CacheStore, CacheEntry } from './type';

export class MemoryCacheStore extends CacheStore {

  store = new Map<string, CacheEntry>();

  reset() {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key)! as CacheEntry;
    if (entry) {
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
    if (entry.stream) {
      entry.data = (await SystemUtil.toBuffer(entry.data as NodeJS.ReadableStream)).toString('base64');
    } else {
      entry.data = JSON.stringify(entry.data);
    }
    this.store.set(key, entry);
  }

  touch(key: string): boolean {
    const entry = this.store.get(key);

    if (!entry || !entry.maxAge) {
      return false;
    }

    entry.expiresAt = entry.maxAge + Date.now();

    return true;
  }

  evict(key: string): boolean {
    return this.store.delete(key);
  }
}