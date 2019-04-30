import { Injectable } from '@travetto/di';
import { Shutdown } from '@travetto/base';

import { Cache } from './cache';
import { CacheConfig } from './types';
import { MemoryCacheStore } from './store/memory';
import { FileCacheStore } from './store/file';

type Simple<T extends Simple<any> = Simple<any>> = { [key: string]: T } | number | string | boolean | T[];

@Injectable()
export class CacheFactory<V = Simple> {

  static defaultConfig = {
    max: 1000,
    ttl: Infinity,
    type: FileCacheStore
  };

  protected caches = new Map<string, Cache<V>>();

  postConstruct() {
    Shutdown.onShutdown('Cache Manager', this.destroy.bind(this));
  }

  async get(config: Partial<CacheConfig<V>> & { name: string }) {
    if (!this.caches.has(config.name)) {
      const cache = new Cache<V>({
        ...CacheFactory.defaultConfig,
        ...(config || {})
      });
      this.caches.set(config.name, cache);
      await cache.init();
    }

    return this.caches.get(config.name)!;
  }

  async clear() {
    await Promise.all([...this.caches.values()].map(x => x.clear()));
  }

  async destroy() {
    await Promise.all([...this.caches.values()].map(x => x.destroy()));
  }
}