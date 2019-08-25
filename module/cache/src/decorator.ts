import * as crypto from 'crypto';

import { ValidCacheFields, CacheStore } from './store/types';
import { CoreCacheConfig, CacheConfig } from './types';

type TypedMethodDecorator<T, U> = (target: T, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => U>) => void;

function generateKey(cache: CacheStore, config: CoreCacheConfig, params: any[]) {
  const input = config.params ? config.params(params) : params;
  const keyParams = config.key ? config.key(...input) : input;
  return cache.computeKey(keyParams);
}

function initConfig(config: CoreCacheConfig, target: any, fn: Function) {
  if (!config.keySpace) {
    config.keySpace = `${target.constructor.name}.${fn.name}`;
  }
}

export function Cache<U extends any>(field: ValidCacheFields<U>, config: CacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) {
    const og = descriptor.value!;
    initConfig(config, target, og);

    descriptor.value = async function (this: U, ...params: any[]) {
      const cache = this[field] as any as CacheStore;
      const key = generateKey(cache, config, params);

      let res = await cache.getOptional(config, key);

      if (res === undefined) {
        const data = await og.apply(this, params);
        res = await cache.setWithAge(config, { key, data });
      }

      if (config.transform) {
        res = config.transform(res);
      }

      return res;
    };
    Object.defineProperty(descriptor.value, 'name', { value: propertyKey });
  };
}

export function EvictCache<U extends any>(field: ValidCacheFields<U>, config: CoreCacheConfig = {}): TypedMethodDecorator<U, Promise<any>> {
  return function (target: U, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => Promise<any>>) {
    const og = descriptor.value!;
    initConfig(config, target, og);

    descriptor.value = async function (this: U, ...params: any[]) {
      const cache = this[field] as any as CacheStore;
      const key = generateKey(cache, config, params);

      const val = await og.apply(this, params);
      await cache.delete(key);
      return val;
    };
    Object.defineProperty(descriptor.value, 'name', { value: propertyKey });
  };
}