import { CacheEntry, CacheStore, CacheConfig } from './types';
import { MemoryCacheStore } from './store/memory';

export class Cache<V> {
  public options: CacheConfig<V>;
  public store: CacheStore<V>;

  constructor(options: Partial<CacheConfig<V>>) {
    this.options = {
      type: MemoryCacheStore,
      max: Infinity,
      ttl: Infinity,
      ...options
    };
    this.store = new this.options.type(this.options.name);
    this.reset();
  }

  private isStale(entry: CacheEntry<V>) {
    if (!entry.ttl && !this.options.ttl) {
      return false;
    }

    return (Date.now() - entry.time) > (entry.ttl || this.options.ttl!);
  }

  private async internalDelete(key: string, hit: CacheEntry<V>) {
    if (!hit) {
      return;
    }
    if (this.options.dispose) {
      this.options.dispose(hit.value, key);
    }

    await this.store.delete(key);
  }

  private async internalGet(key: string, doUse = false) {
    if (this.has(key)) {
      const hit = await this.store.get(key)!;
      if (doUse) {
        hit.time = Date.now();
        this.store.set(key, hit);
      }
      return hit.value;
    } else {
      return;
    }
  }

  async forEach(fn: (v: V, k: string) => void, self?: any) {
    await this.store.forEach((v, k) => fn.call(self, v.value, k));
  }

  get size() {
    return this.store.size;
  }

  async has(key: string) {
    if (!(await this.store.has(key))) {
      return false;
    }
    const hit = await this.store.get(key)!;
    const stale = await this.isStale(hit);
    if (stale) {
      await this.internalDelete(key, hit);
    }
    return !stale;
  }

  async get(key: string) {
    return this.internalGet(key, true);
  }

  async peek(key: string) {
    return this.internalGet(key, false);
  }

  async reset() {
    if (this.options.dispose) {
      this.forEach(this.options.dispose);
    }
    await this.store.clear();
  }

  async set(key: string, value: V, ttl: number = this.options.ttl) {

    const now = ttl ? Date.now() : 0;
    if (this.store.has(key)) {
      if (this.size > this.options.max!) {
        await this.internalDelete(key, await this.store.get(key)!);
        return false;
      }

      const item = await this.store.get(key)!;

      if (this.options.dispose) {
        await this.options.dispose(item.value, key);
      }

      this.get(key);
    }

    const hit: CacheEntry<V> = { value, time: now, ttl };

    this.store.set(key, hit);

    if (this.size > this.options.max) {
      this.store.trim(this.options.max);
    }

    return true;
  }

  async delete(key: string) {
    const val = await this.store.get(key);
    if (val) {
      await this.internalDelete(key, val);
    }
  }

  async cacheExecution(keyFn: (...args: any[]) => string, fn: Function, self: any, args: any[]): Promise<any> {
    // tslint:disable-next-line: no-this-assignment
    const key = keyFn(...args);
    if (!(await this.has(key))) {
      const res = await fn.apply(self, args || []);
      await this.set(key, res);
    }
    return await this.get(key);
  }
}