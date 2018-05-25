import * as LRU from 'lru-cache';

export class CacheManager {
  protected static defaultConfig = {
    max: 1000
  };

  public static caches = new Map<string, LRU.Cache<string, any>>();

  static get<T>(config: string | LRU.Options<string, T> & { name: string }) {
    if (typeof config === 'string') {
      config = { name: config };
    }
    const name = config.name;
    if (!this.caches.has(name)) {
      config = {
        ...this.defaultConfig,
        ...(config as any) || {}
      } as LRU.Options<string, T> & { name: string };
      const cache = LRU<string, T>(config);
      this.caches.set(name, cache);
    }
    return this.caches.get(name)!;
  }

  static cleanup() {
    for (const k of this.caches.keys()) {
      this.caches.get(k)!.reset();
    }
  }
}