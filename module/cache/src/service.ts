import { ExpiresAt, Index, Model, ModelExpirySupport, NotFoundError, ModelStorageUtil, ModelIndexedUtil } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Inject, Injectable } from '@travetto/di';
import { AppError, Runtime, TimeUtil, Util } from '@travetto/runtime';

import { CacheError } from './error.ts';
import { CacheUtil } from './util.ts';
import { CacheAware, CacheConfigSymbol, CacheModelSymbol, EvictConfigSymbol } from './types.ts';

const INFINITE_MAX_AGE = TimeUtil.asMillis(10, 'y');

@Index({
  name: 'keySpace',
  type: 'unsorted',
  fields: [{ keySpace: 1 }]
})
@Model({ autoCreate: false })
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

  constructor(@Inject(CacheModelSymbol, { resolution: 'loose' }) modelService: ModelExpirySupport) {
    this.#modelService = modelService;
  }

  async postConstruct(): Promise<void> {
    if (ModelStorageUtil.isSupported(this.#modelService) && (Runtime.dynamic || this.#modelService.config?.autoCreate)) {
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
      throw new CacheError('Key expired', { category: 'data' });
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (extendOnAccess) {
      const threshold = maxAge / 2;
      if (delta < threshold) {
        await this.#modelService.updatePartial(CacheRecord, {
          id,
          expiresAt: TimeUtil.fromNow(maxAge),
          issuedAt: new Date()
        }); // Do not wait
      }
    }

    const record = await this.#modelService.get(CacheRecord, id);
    return Util.decodeSafeJSON(record.entry);
  }

  /**
   * Set an item into the cache
   * @param maxAge Max age in ms
   * @returns
   */
  async set(id: string, keySpace: string, entry: unknown, maxAge?: number): Promise<unknown> {
    const entryText = Util.encodeSafeJSON(entry);

    const store = await this.#modelService.upsert(CacheRecord,
      CacheRecord.from({
        id,
        entry: entryText!,
        keySpace,
        expiresAt: TimeUtil.fromNow(maxAge || INFINITE_MAX_AGE),
        issuedAt: new Date()
      }),
    );

    return Util.decodeSafeJSON(store.entry);
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
      throw new AppError('Unable to delete all on an un-indexed database');
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
    const config = target[CacheConfigSymbol]![method];

    const id = CacheUtil.generateKey(config, params);

    let res = await this.getOptional(id, config.extendOnAccess);

    if (res === undefined) {
      const data = await fn.apply(target, params);
      res = await this.set(id, config.keySpace!, data, config.maxAge);
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
    const config = target[EvictConfigSymbol]![method];
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