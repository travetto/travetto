import { ExpiresAt, Index, Model, type ModelExpirySupport, NotFoundError, ModelStorageUtil, ModelIndexedUtil } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Inject, Injectable } from '@travetto/di';
import { RuntimeError, JSONUtil, TimeUtil } from '@travetto/runtime';

import { CacheError } from './error.ts';
import { CacheUtil } from './util.ts';
import { type CacheAware, CacheConfigSymbol, CacheModelSymbol, EvictConfigSymbol } from './types.ts';

const INFINITE_MAX_AGE = TimeUtil.duration('10y', 'ms');

@Index({
  name: 'keySpace',
  type: 'unsorted',
  fields: [{ keySpace: 1 }]
})
@Model({ autoCreate: 'production' })
export class CacheRecord {
  id: string;
  @Text()
  entry: string;
  keySpace: string;
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

  constructor(@Inject({ qualifier: CacheModelSymbol, resolution: 'loose' }) modelService: ModelExpirySupport) {
    this.#modelService = modelService;
  }

  /**
   * Get an item throwing an error if missing or expired.  Allows for extending expiry based on access
   * @param id Record identifier
   * @param extendOnAccess should the expiry be extended on access
   */
  async get(id: string, extendOnAccess = true): Promise<unknown> {
    const { expiresAt, issuedAt, entry } = await this.#modelService.get(CacheRecord, id);

    const delta = expiresAt.getTime() - Date.now();
    const maxAge = expiresAt.getTime() - issuedAt.getTime();

    if (delta < 0) { // Expired
      await this.#modelService.delete(CacheRecord, id);
      throw new CacheError('Key expired', { category: 'data' });
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (extendOnAccess) {
      const threshold = maxAge / 2;
      if (delta < threshold) {
        void this.#modelService.updatePartial(CacheRecord, {
          id,
          expiresAt: TimeUtil.fromNow(maxAge),
          issuedAt: new Date()
        });
      }
    }

    return JSONUtil.fromBase64(entry);
  }

  /**
   * Set an item into the cache
   * @param maxAge Max age in ms
   * @returns
   */
  async set(id: string, keySpace: string, entry: unknown, maxAge?: number): Promise<unknown> {
    const entryText = JSONUtil.toBase64(entry);

    const store = await this.#modelService.upsert(CacheRecord,
      CacheRecord.from({
        id,
        entry: entryText!,
        keySpace,
        expiresAt: TimeUtil.fromNow(maxAge || INFINITE_MAX_AGE),
        issuedAt: new Date()
      }),
    );

    return JSONUtil.fromBase64(store.entry);
  }

  /**
   * Remove an item by id
   * @param id
   */
  async delete(id: string): Promise<void> {
    await this.#modelService.delete(CacheRecord, id);
  }

  /**
   * Remove all entries by key space
   * @param id
   */
  async deleteAll(keySpace: string): Promise<void> {
    if (ModelIndexedUtil.isSupported(this.#modelService)) {
      const removes: Promise<void>[] = [];
      for await (const item of this.#modelService.listByIndex(CacheRecord, 'keySpace', { keySpace })) {
        removes.push(this.#modelService.delete(CacheRecord, item.id));
      }
      await Promise.all(removes);
    } else {
      throw new RuntimeError('Unable to delete all on an un-indexed database');
    }
  }

  /**
   * Purge the cache store of all data, if supported
   */
  async purge(): Promise<void> {
    if (ModelStorageUtil.isSupported(this.#modelService) && this.#modelService.truncateModel) {
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
    let result: unknown;

    try {
      result = await this.get(id, extendOnAccess);
    } catch (error) {
      if (!(error instanceof CacheError) && !(error instanceof NotFoundError)) {
        throw error;
      }
    }
    return result;
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
    const config = target[CacheConfigSymbol]![method];

    const id = CacheUtil.generateKey(config, params);

    let result = await this.getOptional(id, config.extendOnAccess);

    if (result === undefined) {
      const data = await fn.apply(target, params);
      result = await this.set(id, config.keySpace!, data, config.maxAge);
    }

    if (config.reinstate) { // Reinstate result value if needed
      result = config.reinstate(result);
    }

    return result;
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
    const config = target[EvictConfigSymbol]![method];
    const id = CacheUtil.generateKey(config, params);
    const result = await fn.apply(target, params);
    try {
      await this.delete(id); // Ignore failure on delete
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }
    return result;
  }
}