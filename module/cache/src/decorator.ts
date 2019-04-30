import { Class, OG_VAL } from '@travetto/registry';

import { CacheConfig } from './types';
import { CacheFactory } from './factory';
import { Cache } from './cache';

type TypedMethodDecorator<U> = (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => U>) => void;

type DecoratorConfig<U> = Partial<CacheConfig<U> & {
  namespace: Class | string;
  keyFn?: (...args: any[]) => string;
}>;

export function Cacheable<U = any>(config: DecoratorConfig<U>): TypedMethodDecorator<Promise<U>> {
  return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<U>>) {
    const fn = descriptor.value!;
    const conf: DecoratorConfig<U> & { name: string } = {
      name: propertyKey,
      keyFn: x => x,
      ...config
    };

    const ns = conf.namespace;
    if (ns) {
      conf.namespace = typeof ns === 'string' ? ns : (ns.__id || ns.name);
      conf.name = `${conf.namespace}.${conf.name}`;
    }

    let cache: Cache<any>;

    const caching = descriptor.value = async function (this: any, ...args: any[]) {
      if (!cache) {
        cache = await CacheFactory.get(conf as { name: string });
      }
      return cache.cacheExecution(conf.keyFn as any, fn, this, args);
    };

    Object.defineProperties(caching, {
      name: { value: fn.name },
      [OG_VAL]: { value: OG_VAL in fn ? (fn as any)[OG_VAL] : fn } // Allow for caching to still expose original method
    });

    return descriptor;
  };
}