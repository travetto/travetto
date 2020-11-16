import { AppError } from '@travetto/base';
import { ModelExpirySupport, ModelRegistry } from '@travetto/model-core';
import { Schema, Text } from '@travetto/schema';
import { Injectable } from '@travetto/di';

import { CacheConfig } from './types';
import { CacheError } from './error';
import { CacheUtil } from './util';

@Schema()
export class CacheType {
  id?: string;
  @Text()
  entry: string;
}

/**
 * Cache source
 */
@Injectable()
export class CacheService {

  /**
   * Time of last culling
   */
  lastCullCheck = Date.now();
  /**
   * Cull rate
   */
  cullRate = 10 * 60000; // 10 minutes

  constructor(private modelService: ModelExpirySupport) { }

  postConstruct() {
    // Manually install model on demand
    ModelRegistry.install(CacheType, { type: 'added', curr: CacheType });
  }

  async getAndCheckAge(config: CacheConfig, key: string) {
    if (this.modelService.deleteExpired) {
      await this.cull();
    }

    const id = this.modelService.uuid(key);

    const { expiresAt, expired, maxAge } = await this.modelService.getExpiry(CacheType, id);

    if (expired) {
      await this.modelService.delete(CacheType, id);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (config.extendOnAccess) {
      const delta = expiresAt - Date.now();
      const threshold = maxAge / 2;
      if (delta < threshold) {
        await this.modelService.updateExpiry(CacheType, id, maxAge); // Do not wait
      }
    }

    const res = await this.modelService.get(CacheType, id);
    return CacheUtil.fromSafeJSON(res.entry);
  }

  async setWithAge(config: CacheConfig, key: string, entry: any) {
    let store: CacheType;
    const id = this.modelService.uuid(key);

    entry = CacheUtil.toSafeJSON(entry);

    if (config.maxAge) {
      store = await this.modelService.upsertWithExpiry(CacheType, { id, entry }, config.maxAge);
    } else {
      store = await this.modelService.upsert(CacheType, { id, entry });
    }

    return CacheUtil.fromSafeJSON(store.entry);
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
    await this.modelService.deleteExpired(CacheType);
  }

  /**
   * Evict an entry by key
   * @param key The key to evict
   */
  async evict(key: string) {
    const id = this.modelService.uuid(key);
    return this.modelService.delete(CacheType, id);
  }
}