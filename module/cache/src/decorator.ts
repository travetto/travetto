import { MethodDescriptor } from '@travetto/base/src/internal/types';
import { RelativeTime, TimeUtil } from '@travetto/base/src/internal/time';

import { CacheService } from './service';
import { CoreCacheConfig, CacheConfig } from './types';
import { CacheAware, CacheConfigⲐ, EvictConfigⲐ } from './internal/types';

/**
 * Indicates a method is intended to cache.  The return type must be properly serializable
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@trv:cache/Cache`
 */
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, maxAge: number | RelativeTime, config?: Omit<CacheConfig, 'maxAge'>): MethodDecorator;
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, cfg?: CacheConfig): MethodDecorator;
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, cfg?: number | RelativeTime | CacheConfig, config: Exclude<CacheConfig, 'maxAge'> = {}) {
  if (cfg !== undefined) {
    if (typeof cfg === 'string') {
      config.maxAge = TimeUtil.toMillis(cfg);
    } else if (typeof cfg === 'number') {
      config.maxAge = cfg;
    } else {
      config = cfg;
    }
  }
  return function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, descriptor: MethodDescriptor<R>) {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[CacheConfigⲐ] ??= {})[propertyKey] = config as CacheConfig;
  };
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@trv:cache/Evict`
 */
export function EvictCache<F extends string, U extends Record<F, CacheService>>(field: F, config: CoreCacheConfig = {}) {
  return function <R extends Promise<unknown>>(target: U & CacheAware, propertyKey: string, descriptor: MethodDescriptor<R>) {
    config.keySpace ??= `${target.constructor.name}.${propertyKey}`;
    (target[EvictConfigⲐ] ??= {})[propertyKey] = config;
  };
}