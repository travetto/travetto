import { Cache } from '../service';
import * as LRU from 'lru-cache';

export function Cacheable(config: string | LRU.Options<any> & { name?: string }, keyFn?: (...args: any[]) => string) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let targetName = `${target.name}-${propertyKey}`;
    if (typeof config !== 'string') {
      if (!config['name']) {
        config['name'] = targetName;
      }
    }

    let orig = (target as any)[propertyKey];

    (target as any)[propertyKey] = (...args: any[]) => {
      if (!target.cache) {
        throw new Error('Cache not defined');
      }

      let cache = target.cache.data;

      let key = keyFn ? keyFn(args) : JSON.stringify(args || []);
      key = `${targetName}||${key}`;
      if (!cache.has(key)) {
        let res = orig.apply(target, args || []);
        if (res && res.catch && res.then) { // If a promise, clear on error
          res.catch((e: any) => cache.del(key));
        }
        cache.set(key, res);
      }
      return cache.get(key);
    };
    return descriptor;
  };
}