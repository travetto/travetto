import { Injectable } from '@encore/di';
import { Shutdown } from '@encore/lifecycle';
import * as LRU from 'lru-cache';

export class CacheManager {
  public caches = new Map<string, LRU.Cache<string, any>>();

  protected defaultConfig = {
    max: 1000
  };

  constructor(private shutdown?: Shutdown) {
    if (shutdown) {
      shutdown.onShutdown('cache', () => this.cleanup());
    }
  }

  get<T>(config: string | LRU.Options<string, T> & { name: string }) {
    if (typeof config === 'string') {
      config = { name: config };
    }
    let name = config.name;
    if (!this.caches.has(name)) {
      config = Object.assign({},
        this.defaultConfig,
        (config as any) || {}
      ) as LRU.Options<string, T> & { name: string };
      let cache = LRU<string, T>(config);
      this.caches.set(name, cache);
    }
    return this.caches.get(name) as LRU.Cache<string, T>;
  }

  cleanup() {
    for (let k of this.caches.keys()) {
      this.caches.get(k)!.reset();
    }
  }
}