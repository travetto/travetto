import { CacheService } from '../service';
import * as LRU from 'lru-cache';

export function Cacheable(config: string | LRU.Options<any> & { name?: string }, keyFn?: (...args: any[]) => string) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    if (typeof config !== 'string') {
      if (!config['name']) {
        config['name'] = `${target.name}-${propertyKey}`;
      }
    }
    let cache = CacheService.getCache(config as (string | LRU.Options<any> & { name: string }));
    let orig = target[propertyKey];

    target[propertyKey] = (...args: any[]) => {
      let key = keyFn ? keyFn(args) : JSON.stringify(args);
      if (!cache.has(key)) {
        let res = orig.apply(target, args);
        cache.set(key, res);
      }
      return cache.get(key);
    };
    return descriptor;
  };
}