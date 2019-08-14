import { ValidCacheFields } from './store/type';
import { CacheManager, CacheConfig } from './service';

type TypedMethodDecorator<T, U> = (target: T, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => U>) => void;

export function Cache<U>(field: ValidCacheFields<U>, config: CacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
    descriptor.value = CacheManager.decorate(target, field, descriptor.value!, config);
    return descriptor;
  };
}