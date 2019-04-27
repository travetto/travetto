import { Class, OG_VAL } from '@travetto/registry';

import { CacheConfig } from './types';
import { CacheFactory } from './service';

type TypedMethodDecorator<U> = (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => U>) => void;

type DecoratorConfig<U> = Partial<CacheConfig<U> & {
  namespace: Class | string;
  keyFn?: (...args: any[]) => string;
}>;

export function Cacheable<U = any>(config: DecoratorConfig<U>): TypedMethodDecorator<Promise<U>> {
  return function <C extends { cache: CacheFactory<U> }>(target: C, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<U>>) {
    const fn = descriptor.value!;
    const conf: DecoratorConfig<U> & { name: string } = {
      name: propertyKey,
      keyFn: x => JSON.stringify(x),
      ...config
    };

    const ns = conf.namespace;
    if (ns) {
      conf.namespace = typeof ns === 'string' ? ns : (ns.__id || ns.name);
      conf.name = `${conf.namespace}.${conf.name}`;
    }

    let cache: any;

    const caching = descriptor.value = function (this: { cache: CacheFactory<U> }, ...args: any[]) {
      if (!cache) {
        cache = this.cache.get(conf as { name: string });
      }
      return cache.cacheExecution(conf.keyFn, fn, this, args);
    };

    Object.defineProperties(caching, {
      name: { value: fn.name },
      [OG_VAL]: { value: OG_VAL in fn ? (fn as any)[OG_VAL] : fn } // Allow for caching to still expose original method
    });

    return descriptor;
  };
}