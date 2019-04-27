import { Injectable } from '@travetto/di';
import { Shutdown } from '@travetto/base';

import { Cache } from './cache';
import { CacheConfig } from './types';

type Simple<T extends Simple<any> = Simple<any>> = { [key: string]: T } | number | string | boolean | T[];

@Injectable()
export class CacheFactory<V = Simple> {
  protected static defaultConfig = { max: 1000 };

  protected caches = new Map<string, Cache<V>>();

  postConstruct() {
    Shutdown.onShutdown('Cache Manager', this.cleanup.bind(this));
  }

  get(config: Partial<CacheConfig<V>> & { name: string }) {
    const name = config.name;

    if (!this.caches.has(name)) {
      this.caches.set(name, new Cache({
        ...CacheFactory.defaultConfig,
        ...(config || {})
      }));
    }

    return this.caches.get(name)!;
  }

  async cleanup() {
    for (const c of this.caches.values()) {
      await c.reset();
    }
  }
}