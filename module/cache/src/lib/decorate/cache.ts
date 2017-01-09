import { CacheService } from '../service';
import * as LRU from 'lru-cache';

export function Cacheable(config: string | LRU.Options<any> & { name?: string }, keyFn?: (...args: any[]) => string) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let targetName = `${target.name}-${propertyKey}`;
    if (typeof config !== 'string') {
      if (!config['name']) {
        config['name'] = targetName;
      }
    }
    let cache = CacheService.getCache(config as (string | LRU.Options<any> & { name: string }));
    let orig = target[propertyKey];

    target[propertyKey] = (...args: any[]) => {
      let key = keyFn ? keyFn(args) : JSON.stringify(args || []);
      key = `${targetName}||${key}`;
      if (!cache.has(key)) {
        let res = orig.apply(target, args || []);
        cache.set(key, res);
      }
      return cache.get(key);
    };
    return descriptor;
  };
}