import { CacheService } from './source/core';
import { CoreCacheConfig, CacheConfig } from './types';

type ValidCacheFields<T> = {
  [K in keyof T]:
  (T[K] extends CacheService<any> ? K : never)
}[keyof T];

type TypedMethodDecorator<T, U> = (target: T, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => U>) => void;

/**
 * Indicates a method is intended to cache.  The return type must be properly serializable
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@trv:cache/Cache`
 */
export function Cache<U>(field: ValidCacheFields<U>, config: CacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) { };
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 * @param field The field of the cache source
 * @param config The additional cache configuration
 * @augments `@trv:cache/Evict`
 */
export function EvictCache<U>(field: ValidCacheFields<U>, config: CoreCacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) { };
}