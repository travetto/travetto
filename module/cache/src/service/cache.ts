import { OnShutdown } from '@encore/lifecycle';
import { CacheConfig } from './config';
import { Injectable } from '@encore/di';
import * as LRU from 'lru-cache';

@Injectable()
export class CacheService {
  private caches: { [key: string]: LRU.Cache<any> } = {};
  private defaultConfig = {
    max: 1000
  };

  constructor(private config: CacheConfig) { }

  getCache<T>(config: string | LRU.Options<T> & { name: string }) {
    let name: string;
    if (typeof config === 'string') {
      name = config;
    } else {
      name = config.name;
    }
    if (!this.caches.hasOwnProperty(name)) {
      if (typeof config === 'string') {
        config = Object.assign({},
          this.defaultConfig,
          (this.config as any)['default'] || {},
          (this.config as any)[name] || {}
        ) as LRU.Options<T> & { name: string };
      }
      this.caches[name] = LRU(config);
    }
    return this.caches[name] as LRU.Cache<T>;
  }

  @OnShutdown()
  clear() {
    for (let k of Object.keys(this.caches)) {
      this.caches[k].reset();
    }
  }
}