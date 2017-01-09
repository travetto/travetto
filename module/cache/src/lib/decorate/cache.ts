import { CacheService } from '../service';
import * as LRU from 'lru-cache';

export function Cache(config: string | LRU.Options<any> & { name?: string }) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    if (typeof config !== 'string') {
      if (!config['name']) {
        config['name'] = `${target.name}-${propertyKey}`;
      }
    }
    let cache = CacheService.getCache(config as (string | LRU.Options<any> & { name: string }));
    let orig = target[propertyKey];

    descriptor.value = (...args: any[]) => {
      let key = JSON.stringify(args);
      if (!cache.has(key)) {
        let res = orig.apply(target, args);
        cache.set(key, res);
      }
      return cache.get(key);
    };
    return descriptor;
  };
}