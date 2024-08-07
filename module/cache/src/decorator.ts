import { TimeSpan, TimeUtil } from '@travetto/runtime';

import { CacheService } from './service';
import { CoreCacheConfig, CacheConfig } from './types';
import { CacheAware, CacheConfigⲐ, EvictConfigⲐ } from './internal/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MethodDescriptor<R = any, V = unknown> = TypedPropertyDescriptor<(this: V, ...params: any[]) => R>;

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
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const dec = function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, descriptor: MethodDescriptor<R>): void {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[CacheConfigⲐ] ??= {})[propertyKey] = config;
  } as MethodDecorator;
  return dec;
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@travetto/cache:Evict`
 */
export function EvictCache<F extends string, U extends Record<F, CacheService>>(field: F, config: CoreCacheConfig = {}) {
  return function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, descriptor: MethodDescriptor<R>): void {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[EvictConfigⲐ] ??= {})[propertyKey] = config;
  };
}