import { CoreCacheConfig, CacheConfig, CacheStoreType } from './types';

type ValidCacheFields<T> = {
  [K in keyof T]:
  (T[K] extends CacheStoreType ? K : never)
}[keyof T];

type TypedMethodDecorator<T, U> = (target: T, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => U>) => void;

/**
 * Indicates a method is intended to cache.  The return type must be properly serializable
 *
 * @augments trv/cache/Cache
 */
export function Cache<U>(field: ValidCacheFields<U>, config: CacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) { };
}

/**
 * Indicates a method  should evict entries from a cache.  A common pattern is an update operation evicting the cache so the
 * freshest data will be collected
 *
 * @augments trv/cache/Evict
 */
export function EvictCache<U>(field: ValidCacheFields<U>, config: CoreCacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) { };
}