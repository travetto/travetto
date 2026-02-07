import { castTo, type MethodDescriptor, type TimeSpan, TimeUtil } from '@travetto/runtime';

import type { CacheService } from './service.ts';
import { type CoreCacheConfig, type CacheConfig, type CacheAware, CacheConfigSymbol, EvictConfigSymbol } from './types.ts';

/**
 * Indicates a method is intended to cache.  The return type must be properly serializable
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @kind decorator
 */
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, maxAge: number | TimeSpan, config?: Omit<CacheConfig, 'maxAge'>): MethodDecorator;
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, input?: CacheConfig): MethodDecorator;
export function Cache<F extends string, U extends Record<F, CacheService>>(
  field: F, input?: number | TimeSpan | CacheConfig, config: Exclude<CacheConfig, 'maxAge'> = {}
): MethodDecorator {
  if (input !== undefined) {
    if (typeof input === 'string' || typeof input === 'number') {
      config.maxAge = TimeUtil.duration(input, 'ms');
    } else {
      config = input;
    }
  }
  const decorator = function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, descriptor: MethodDescriptor<R>): void {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[CacheConfigSymbol] ??= {})[propertyKey] = config;
    const handler = descriptor.value!;
    // Allows for DI to run, as the service will not be bound until after the decorator is run
    descriptor.value = castTo(function (this: typeof target) {
      return this[field].cache(this, propertyKey, handler, [...arguments]);
    });
    Object.defineProperty(descriptor.value, 'name', { value: propertyKey, writable: false });
  };
  return castTo(decorator);
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @kind decorator
 */
export function EvictCache<F extends string, U extends Record<F, CacheService>>(field: F, config: CoreCacheConfig = {}) {
  return function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, descriptor: MethodDescriptor<R>): void {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[EvictConfigSymbol] ??= {})[propertyKey] = config;
    const handler = descriptor.value!;
    // Allows for DI to run, as the service will not be bound until after the decorator is run
    descriptor.value = castTo(function (this: typeof target) {
      return this[field].evict(this, propertyKey, handler, [...arguments]);
    });
    Object.defineProperty(descriptor.value, 'name', { value: propertyKey, writable: false });
  };
}