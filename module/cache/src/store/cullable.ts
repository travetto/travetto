import { CacheEntry } from '../types';
import { CacheStore } from './core';

// TODO: Document
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
        } catch (e) {
          try {
            await this.delete(key);
          } catch (err) {
            console.error('Unable to remove cache entry', err);
          }
        }
      })());
    }
    await Promise.all(all);
  }
}