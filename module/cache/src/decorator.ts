import { SystemUtil } from '@travetto/base';

import { ValidCacheFields, CacheStore } from './store/types';
import { CacheManager } from './service';
import { CoreCacheConfig, CacheConfig } from './types';

type TypedMethodDecorator<T, U> = (target: T, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: any[]) => U>) => void;

function generateKey(cache: CacheStore, config: CoreCacheConfig, params: any[]) {
  const input = config.params ? config.params(params) : params;
  let finalKey: string;

  if (config.key) {
    finalKey = config.key(...input);
  } else {
    const key = cache.computeKey(...input);
    finalKey = `${key.substring(0, 100)}:${SystemUtil.naiveHash(key)}`;
  }
  return Buffer.from(`${config.keySpace}:${finalKey}`, 'utf8').toString('base64').replace(/=+$/, '');
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

      let res = await CacheManager.getOptional(cache, config, key);

      if (res === undefined) {
        const val = await og.apply(this, params);
        res = await CacheManager.set(cache, config, key, val);
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
      await CacheManager.evict(cache, key);
      return val;
    };
    Object.defineProperty(descriptor.value, 'name', { value: propertyKey });
  };
}