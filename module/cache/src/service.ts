import { ExpiresAt, Model, ModelExpirySupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Inject, Injectable } from '@travetto/di';
import { GlobalEnv } from '@travetto/base';
import { isStorageSupported } from '@travetto/model/src/internal/service/common';

import { CacheError } from './error';
import { CacheUtil } from './util';
import { CacheAware, CacheConfigⲐ, EvictConfigⲐ } from './internal/types';

export const CacheModelⲐ = Symbol.for('@travetto/cache:model');

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

  async postConstruct(): Promise<void> {
    if (isStorageSupported(this.#modelService) && GlobalEnv.dynamic) {
      await this.#modelService.createModel?.(CacheRecord);
    }
  }

  /**
   * Get an item throwing an error if missing or expired.  Allows for extending expiry based on access
   * @param id Record identifier
   * @param extendOnAccess should the expiry be extended on access
   */
  async get(id: string, extendOnAccess = true): Promise<unknown> {
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
  async set(id: string, entry: unknown, maxAge?: number): Promise<unknown> {
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

  /**
   * Remove an item by id
   * @param id
   */
  async delete(id: string): Promise<void> {
    await this.#modelService.delete(CacheRecord, id);
  }

  /**
   * Purge the cache store of all data, if supported
   */
  async purge(): Promise<void> {
    if (isStorageSupported(this.#modelService) && this.#modelService.truncateModel) {
      await this.#modelService.truncateModel(CacheRecord);
    } else {
      console.warn(`${this.#modelService.constructor.name} does not support truncating the data set`);
    }
  }

  /**
   * Get an item optionally, returning undefined if missing.  Allows for extending expiry based on access
   * @param id Record identifier
   * @param extendOnAccess should the expiry be extended on access
   */
  async getOptional(id: string, extendOnAccess = true): Promise<unknown | undefined> {
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
   * @param target Object to run as context
   * @param method Name of method to run
   * @param fn Function to execute
   * @param params input parameters
   */
  async cache(target: CacheAware, method: string, fn: Function, params: unknown[]): Promise<unknown | undefined> {
    const config = target[CacheConfigⲐ]![method];

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
   * @param target Object to run as context
   * @param method Name of method to run
   * @param fn Function to execute
   * @param params Input params to the function
   */
  async evict(target: CacheAware, method: string, fn: Function, params: unknown[]): Promise<unknown> {
    const config = target[EvictConfigⲐ]![method];
    const id = CacheUtil.generateKey(config, params);
    const val = await fn.apply(target, params);
    try {
      await this.delete(id); // Ignore failure on delete
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }
    return val;
  }
}