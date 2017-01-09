import { OnShutdown } from '@encore/lifecycle';
import * as LRU from 'lru-cache';
import Config from '../config';

export class CacheService {
  private static caches: { [key: string]: LRU.Cache<any> } = {};
  private static defaultConfig = {
    max: 1000
  };

  static getCache<T>(config: string | LRU.Options<T> & { name: string }) {
    let name: string;
    if (typeof config === 'string') {
      name = config;
    } else {
      name = config.name;
    }
    if (!CacheService.caches.hasOwnProperty(name)) {
      if (typeof config === 'string') {
        config = Object.assign({},
          CacheService.defaultConfig,
          (Config as any)['default'] || {},
          (Config as any)[name] || {}
        ) as LRU.Options<T> & { name: string };
      }
      CacheService.caches[name] = LRU(config);
    }
    return CacheService.caches[name] as LRU.Cache<T>;
  }

  @OnShutdown()
  static clear() {
    for (let k of Object.keys(CacheService.caches)) {
      CacheService.caches[k].reset();
    }
  }
}