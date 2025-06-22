import { castTo, MethodDescriptor, TimeSpan, TimeUtil } from '@travetto/runtime';

import { CacheService } from './service.ts';
import { CoreCacheConfig, CacheConfig, CacheAware, CacheConfigSymbol, EvictConfigSymbol } from './types.ts';

/**
 * Indicates a method is intended to cache.  The return type must be properly serializable
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@travetto/cache:Cache`
 */
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, maxAge: number | TimeSpan, config?: Omit<CacheConfig, 'maxAge'>): MethodDecorator;
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, cfg?: CacheConfig): MethodDecorator;
export function Cache<F extends string, U extends Record<F, CacheService>>(
  field: F, cfg?: number | TimeSpan | CacheConfig, config: Exclude<CacheConfig, 'maxAge'> = {}
): MethodDecorator {
  if (cfg !== undefined) {
    if (typeof cfg === 'string' || typeof cfg === 'number') {
      config.maxAge = TimeUtil.asMillis(cfg);
    } else {
      config = cfg;
    }
  }
  const dec = function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, _descriptor: MethodDescriptor<R>): void {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[CacheConfigSymbol] ??= {})[propertyKey] = config;
    const handler = _descriptor.value!.bind(castTo(target));
    // Allows for DI to run, as the service will not be bound until after the decorator is run
    _descriptor.value = castTo(function (this: typeof target) {
      return this[field].cache(this, propertyKey, handler, [...arguments]);
    });
    Object.defineProperty(_descriptor.value, 'name', { value: propertyKey, writable: false });
  };
  return castTo(dec);
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@travetto/cache:Evict`
 */
export function EvictCache<F extends string, U extends Record<F, CacheService>>(field: F, config: CoreCacheConfig = {}) {
  return function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, _descriptor: MethodDescriptor<R>): void {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[EvictConfigSymbol] ??= {})[propertyKey] = config;
    const handler = _descriptor.value!.bind(castTo(target));
    // Allows for DI to run, as the service will not be bound until after the decorator is run
    _descriptor.value = castTo(function (this: typeof target) {
      return this[field].evict(this, propertyKey, handler, [...arguments]);
    });
    Object.defineProperty(_descriptor.value, 'name', { value: propertyKey, writable: false });
  };
}