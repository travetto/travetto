import { AppError } from '@travetto/base';
import { ModelExpirySupport, ModelRegistry } from '@travetto/model-core';
import { Schema, Text } from '@travetto/schema';
import { Inject, Injectable } from '@travetto/di';

import { CacheConfig } from './types';
import { CacheError } from './error';
import { CacheUtil } from './util';

export const CacheModelSymbol = Symbol.for('@trv:cache/model');

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

  constructor(@Inject(CacheModelSymbol) private modelService: ModelExpirySupport) { }

  postConstruct() {
    // Manually install model on demand
    ModelRegistry.install(CacheType, { type: 'added', curr: CacheType });
  }

  async getAndCheckAge(config: CacheConfig, id: string) {
    if (this.modelService.deleteExpired) {
      await this.cull();
    }

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

  async setWithAge(config: CacheConfig, id: string, entry: any) {
    let store: CacheType;

    entry = CacheUtil.toSafeJSON(entry);

    if (config.maxAge) {
      store = await this.modelService.upsertWithExpiry(CacheType, { id, entry }, config.maxAge);
    } else {
      store = await this.modelService.upsert(CacheType, { id, entry });
    }

    return CacheUtil.fromSafeJSON(store.entry);
  }

  async getOptional(config: CacheConfig, id: string) {
    let res: any;

    try {
      res = await this.getAndCheckAge(config, id);
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
   * Cache the function output
   *
   * @param config Cache configuration
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params input parameters
   */
  async cache(config: CacheConfig, target: any, fn: Function, params: any[]) {
    const id = CacheUtil.generateKey(config, params);

    let res = await this.getOptional(config, id);

    if (res === undefined) {
      const data = await fn.apply(target, params);
      res = await this.setWithAge(config, id, data);
    }

    if (config.reinstate) { // Reinstate result value if needed
      res = config.reinstate(res);
    }

    return res;
  }

  /**
   * Evict value from cache
   *
   * @param config Cache config
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params Input params to the function
   */
  async evict(config: CacheConfig, target: any, fn: Function, params: any[]) {
    const id = CacheUtil.generateKey(config, params);
    const val = await fn.apply(target, params);
    await this.modelService.delete(CacheType, id);
    return val;
  }
}