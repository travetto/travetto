import * as LRU from 'lru-cache';

type Class<T> = { new(...args: any[]): T };
export type CacheConfig<T> = LRU.Options<string, T> & { namespace?: string, name: string, keyFn?: (...args: any[]) => string };

export class CacheManager {
  protected static defaultConfig = {
    max: 1000
  };

  public static caches = new Map<string, LRU.Cache<string, any>>();

  static get<T>(config: CacheConfig<T>) {
    const name = config.name;

    if (!this.caches.has(name)) {
      config = {
        ...this.defaultConfig,
        ...(config || {})
      };
      const cache = new LRU<string, T>(config);
      this.caches.set(name, cache);
    }
    return this.caches.get(name)!;
  }

  static cleanup() {
    for (const k of this.caches.keys()) {
      this.caches.get(k)!.reset();
    }
  }

  static enableCaching<T>(fn: Function, conf: (CacheConfig<T> | { name?: string, namespace?: Class<any> })) {
    let config: CacheConfig<T>;

    if (conf.namespace && typeof conf.namespace !== 'string') {
      conf.namespace = conf.namespace.__id || conf.namespace.name;
    }

    if (!conf.name) {
      conf.name = fn.name;
    }

    config = conf as CacheConfig<T>;

    if (config.namespace) {
      config.name = `${config.namespace}.${config.name}`;
    }

    const cache = this.get(config);

    const caching = function (this: any, ...args: any[]): any {
      const key = config.keyFn ? config.keyFn.apply(undefined, args) : JSON.stringify(args || []);

      if (!cache.has(key)) {
        const res = fn.apply(this, args || []); // tslint:disable-line no-invalid-this
        if (res && res.catch && res.then) { // If a promise, clear on error
          res.catch((e: any) => cache.del(key));
        }
        cache.set(key, res);
      }
      return cache.get(key);
    } as any;

    Object.defineProperty(caching, 'name', { value: fn.name });

    return caching;
  }
}