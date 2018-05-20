import { CacheManager } from '../service';
import * as LRU from 'lru-cache';

export function Cacheable<U>(config: string | LRU.Options<string, U> & { name?: string }, keyFn?: (...args: any[]) => string) {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => U>) => {
    const targetName = `${target.name}-${propertyKey}`;
    if (typeof config !== 'string') {
      if (!config['name']) {
        config['name'] = `${(target.__id || target.name)}.${propertyKey}`;
      }
    }

    const orig = descriptor.value! as any as (...args: any[]) => U;
    const cache = CacheManager.get<any>(config as any);

    descriptor.value = function (this: any, ...args: any[]): U {
      let key = keyFn ? keyFn(args) : JSON.stringify(args || []);
      key = `${targetName}||${key}`;
      if (!cache.has(key)) {
        const res = orig.apply(this, args || []); // tslint:disable-line no-invalid-this
        if (res && res.catch && res.then) { // If a promise, clear on error
          res.catch((e: any) => cache.del(key));
        }
        cache.set(key, res);
      }
      return cache.get(key);
    } as any;

    Object.defineProperty(descriptor.value, 'name', { value: (orig as any).name });

    return descriptor;
  };
}