import { CacheStoreType, CacheConfig, CoreCacheConfig } from './types';

// TODO: Document
export class CacheUtil {
  static generateKey(config: CoreCacheConfig, cache: CacheStoreType, params: any[]) {
    const input = config.params?.(params) ?? params;
    const keyParams = config.key?.(...input) ?? input;
    return `${config.keySpace!}♯${cache.computeKey(keyParams)}`;
  }

  static async cache(config: CacheConfig, cache: CacheStoreType, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, cache, params);

    let res = await cache.getOptional(config, key);

    if (res === undefined) {
      let data = await fn.apply(target, params);
      if (config.serialize) {
        data = config.serialize(data);
      }
      res = (await cache.setWithAge(config, { key, data })).data;
    }

    if (config.reinstate) { // Reinstate result value if needed
      res = config.reinstate(res);
    }

    return res;
  }

  static async evict(config: CacheConfig, cache: CacheStoreType, target: any, fn: Function, params: any[]) {
    const key = this.generateKey(config, cache, params);
    const val = await fn.apply(target, params);
    await cache.delete(key);
    return val;
  }
}