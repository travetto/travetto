import { CacheEntry } from '../types';
import { CacheSource } from './core';

/**
 * Cullable cache source.
 *
 * This implies the data source can be culled as on expiry
 */
export abstract class CullableCacheSource<T extends CacheEntry = CacheEntry> extends CacheSource<T> {

  /**
   * Time of last culling
   */
  lastCullCheck = Date.now();
  /**
   * Cull rate
   */
  cullRate = 10 * 60000; // 10 minutes

  /**
   * Cull an entry from the key
   */
  async cullEntry(key: string) {
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
  }

  /**
   * Cull expired data
   */
  async cull(force = false) {
    if (!force && (Date.now() - this.lastCullCheck) < this.cullRate) {
      return;
    }

    this.lastCullCheck = Date.now();

    const all = [...await this.keys()].map(k => this.cullEntry(k));
    await Promise.all(all);
  }
}