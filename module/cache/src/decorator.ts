import { MethodDescriptor } from '@travetto/base/src/internal/types';

import { CacheService } from './service';
import { CoreCacheConfig, CacheConfig } from './types';

/**
 * Indicates a method is intended to cache.  The return type must be properly serializable
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@trv:cache/Cache`
 */
export function Cache<F extends string, U extends Record<F, CacheService>>(field: F, config: CacheConfig = {}) {
  return function <R extends Promise<unknown>>(target: U, propertyKey: string, descriptor: MethodDescriptor<R>) { };
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@trv:cache/Evict`
 */
export function EvictCache<F extends string, U extends Record<F, CacheService>>(field: F, config: CoreCacheConfig = {}) {
  return function <R extends Promise<unknown>>(target: U, propertyKey: string, descriptor: MethodDescriptor<R>) { };
}