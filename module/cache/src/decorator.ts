import { CacheManager, CacheConfig } from './service';

type TypedMethodDecorator<U> = (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => U>) => void;

export function Cacheable<U>(config: Partial<CacheConfig<U>> & { dispose: (k: string, v: U) => any }, keyFn?: (...args: any[]) => string): TypedMethodDecorator<U>;
export function Cacheable(config: string | Partial<CacheConfig<any>>, keyFn?: (...args: any[]) => string): TypedMethodDecorator<any>;
export function Cacheable(config: string | Partial<CacheConfig<any>>, keyFn?: (...args: any[]) => string): TypedMethodDecorator<any> {
  return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) {
    if (typeof config === 'string') {
      config = {
        namespace: config
      };
    }
    descriptor.value = CacheManager.enableCaching(descriptor.value as Function, {
      namespace: target.constructor,
      name: propertyKey,
      keyFn,
      ...config,
    });

    return descriptor;
  };
}