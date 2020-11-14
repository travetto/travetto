import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ModelExpirySupport, ModelType } from '@travetto/model-core';

import { CacheConfig } from '../types';
import { CacheSourceUtil } from './util';
import { CacheError } from './error';

/**
 * Cache source
 */
export class CacheService<T extends ModelType>  {

  /**
   * Time of last culling
   */
  lastCullCheck = Date.now();
  /**
   * Cull rate
   */
  cullRate = 10 * 60000; // 10 minutes

  constructor(private cls: Class<T>, private modelService: ModelExpirySupport) { }

  computeKey(params: any) {
    return CacheSourceUtil.computeKey(params);
  }

  async getAndCheckAge(config: CacheConfig, key: string) {
    const { expiresAt, expired, maxAge } = await this.modelService.getExpiry(this.cls, key);

    if (expired) {
      await this.modelService.delete(this.cls, key);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (config.extendOnAccess) {
      const delta = expiresAt - Date.now();
      const threshold = maxAge / 2;
      if (delta < threshold) {
        await this.modelService.updateExpiry(this.cls, key, maxAge); // Do not wait
      }
    }

    return await this.modelService.get(this.cls, key);
  }

  async setWithAge(config: CacheConfig, key: string, entry: T) {
    entry.id = key;

    let store;

    if (config.maxAge) {
      store = await this.modelService.upsertWithExpiry(this.cls, entry, config.maxAge);
    } else {
      store = await this.modelService.upsert(this.cls, entry);
    }

    return store;
  }

  async getOptional(config: CacheConfig, key: string) {
    let res: any;

    try {
      res = await this.getAndCheckAge(config, key);
    } catch (err) {
      if (!(err instanceof CacheError) && !(err instanceof AppError && err.category !== 'notfound')) {
        throw err;
      }
    }
    return res;
  }

  /**
   * Cull expired data
   */
  async cull(force = false) {
    if (!this.modelService.deleteExpired || (!force && (Date.now() - this.lastCullCheck) < this.cullRate)) {
      return;
    }

    this.lastCullCheck = Date.now();
    await this.modelService.deleteExpired(this.cls);
  }

  /**
   * Evict an entry by key
   * @param key The key to evict
   */
  async evict(key: string) {
    return this.modelService.delete(this.cls, key);
  }
}