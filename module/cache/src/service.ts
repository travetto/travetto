import { ExpiresAt, Model, ModelExpirySupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Inject, Injectable } from '@travetto/di';
import { EnvUtil } from '@travetto/boot';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';

import { CacheConfig } from './types';
import { CacheError } from './error';
import { CacheUtil } from './util';

export const CacheModelⲐ = Symbol.for('@trv:cache/model');

const INFINITE_MAX_AGE = '5000-01-01';

@Model({ autoCreate: false })
export class CacheRecord {
  id: string;
  @Text()
  entry: string;
  @ExpiresAt()
  expiresAt: Date;
  issuedAt: Date;
}

/**
 * Cache source
 */
@Injectable()
export class CacheService {

  #modelService: ModelExpirySupport;

  constructor(@Inject(CacheModelⲐ, { resolution: 'loose' }) modelService: ModelExpirySupport) {
    this.#modelService = modelService;
  }

  async postConstruct() {
    if (isStorageSupported(this.#modelService) && EnvUtil.isDynamic()) {
      await this.#modelService.createModel?.(CacheRecord);
    }
  }

  async get(id: string, extendOnAccess = true) {
    const { expiresAt, issuedAt } = await this.#modelService.get(CacheRecord, id);

    const delta = expiresAt.getTime() - Date.now();
    const maxAge = expiresAt.getTime() - issuedAt.getTime();

    if (delta < 0) { // Expired
      await this.#modelService.delete(CacheRecord, id);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (extendOnAccess) {
      const threshold = maxAge / 2;
      if (delta < threshold) {
        await this.#modelService.updatePartial(CacheRecord, {
          id,
          expiresAt: new Date(Date.now() + maxAge),
          issuedAt: new Date()
        }); // Do not wait
      }
    }

    const res = await this.#modelService.get(CacheRecord, id);
    return CacheUtil.fromSafeJSON(res.entry);
  }

  /**
   * Set an item into the cache
   * @param maxAge Max age in ms
   * @returns
   */
  async set(id: string, entry: unknown, maxAge?: number) {
    const entryText = CacheUtil.toSafeJSON(entry);

    const store = await this.#modelService.upsert(CacheRecord,
      CacheRecord.from({
        id,
        entry: entryText!,
        expiresAt: new Date(maxAge ? maxAge + Date.now() : INFINITE_MAX_AGE),
        issuedAt: new Date()
      }),
    );

    return CacheUtil.fromSafeJSON(store.entry);
  }

  async delete(id: string) {
    await this.#modelService.delete(CacheRecord, id);
  }

  async getOptional(id: string, extendOnAccess = true) {
    let res: unknown;

    try {
      res = await this.get(id, extendOnAccess);
    } catch (err) {
      if (!(err instanceof CacheError) && !(err instanceof NotFoundError)) {
        throw err;
      }
    }
    return res;
  }

  /**
   * Cache the function output
   *
   * @param config Cache configuration
   * @param target Object to run as context
   * @param fn Function to execute
   * @param params input parameters
   */
  async cache(config: CacheConfig, target: unknown, fn: Function, params: unknown[]) {
    const id = CacheUtil.generateKey(config, params);

    let res = await this.getOptional(id, config.extendOnAccess);

    if (res === undefined) {
      const data = await fn.apply(target, params);
      res = await this.set(id, data, config.maxAge);
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
  async evict(config: CacheConfig, target: unknown, fn: Function, params: unknown[]) {
    const id = CacheUtil.generateKey(config, params);
    const val = await fn.apply(target, params);
    await this.delete(id);
    return val;
  }
}