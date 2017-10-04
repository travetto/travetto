import { CacheManager } from '../service';
import * as LRU from 'lru-cache';

export function Cacheable(config: string | LRU.Options<any> & { name?: string }, keyFn?: (...args: any[]) => string) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let targetName = `${target.name}-${propertyKey}`;
    if (typeof config !== 'string') {
      if (!config['name']) {
        config['name'] = `${(target.__id || target.name)}.${propertyKey}`;
      }
    }

    let orig = descriptor.value;
    let cache = CacheManager.get<any>(config as any);

    descriptor.value = function (...args: any[]) {
      let key = keyFn ? keyFn(args) : JSON.stringify(args || []);
      key = `${targetName}||${key}`;
      if (!cache.has(key)) {
        let res = orig.apply(this, args || []);
        if (res && res.catch && res.then) { // If a promise, clear on error
          res.catch((e: any) => cache.del(key));
        }
        cache.set(key, res);
      }
      return cache.get(key);
    };

    Object.defineProperty(descriptor.value, 'name', { value: (orig as any).name });

    return descriptor;
  };
}