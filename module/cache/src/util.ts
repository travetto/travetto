import { CacheConfig, CoreCacheConfig } from './types';
import { CacheStore } from './store/types';

export class CacheUtil {
  static generateKey(cache: CacheStore, config: CoreCacheConfig, params: any[]) {
    const input = config.params ? config.params(params) : params;
    const keyParams = config.key ? config.key(...input) : input;
    return cache.computeKey(keyParams);
  }

  static async cache(config: CacheConfig, cache: CacheStore, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(cache, config, params);

    let res = await cache.getOptional(config, key);

    if (res === undefined) {
      let data = await fn.apply(target, params);
      if (config.serialize) {
        data = config.serialize(data);
      }
      res = (await cache.setWithAge(config, { key, data })).data;
    }

    if (config.deserialize) {
      res = config.deserialize(res);
    }

    return res;
  }

  static async evict(config: CacheConfig, cache: CacheStore, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(cache, config, params);
    const val = await fn.apply(target, params);
    await cache.delete(key);
    return val;
  }
}