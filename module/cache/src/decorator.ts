import { CoreCacheConfig, CacheConfig, ValidCacheFields } from './types';

type TypedMethodDecorator<T, U> = (target: T, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => U>) => void;

/**
 * @augments trv/cache/Cache
 */
export function Cache<U extends any>(field: ValidCacheFields<U>, config: CacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) { };
}

/**
 * @augments trv/cache/Evict
 */
export function EvictCache<U extends any>(field: ValidCacheFields<U>, config: CoreCacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) { };
}