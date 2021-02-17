import { ExpiresAt, IssuedAt, Model, ModelExpirySupport, NotFoundError } from '@travetto/model';
import { Text } from '@travetto/schema';
import { Inject, Injectable } from '@travetto/di';

import { CacheConfig } from './types';
import { CacheError } from './error';
import { CacheUtil } from './util';

export const CacheModelSym = Symbol.for('@trv:cache/model');

const INFINITE_MAX_AGE = '10000-01-01';

@Model({ for: CacheModelSym })
export class CacheType {
  id?: string;
  @Text()
  entry: string;
  @ExpiresAt()
  expiresAt: Date;
  @IssuedAt()
  issuedAt: Date;
}

/**
 * Cache source
 */
@Injectable()
export class CacheService {

  constructor(@Inject(CacheModelSym) private modelService: ModelExpirySupport) { }

  async get(id: string, extendOnAccess = true) {
    const { expiresAt, expired, maxAge } = await this.modelService.getExpiry(CacheType, id);

    if (expired) {
      await this.modelService.delete(CacheType, id);
      throw new CacheError('Key expired', 'data');
    }

    // If half way to eviction, not perfect, but will reduce the amount of unnecessary updates
    if (extendOnAccess) {
      const delta = expiresAt.getTime() - Date.now();
      const threshold = maxAge! / 2;
      if (delta < threshold) {
        await this.modelService.updatePartial(CacheType, id, {
          expiresAt: new Date(Date.now() + maxAge!),
          issuedAt: new Date()
        }); // Do not wait
      }
    }

    const res = await this.modelService.get(CacheType, id);
    return CacheUtil.fromSafeJSON(res.entry);
  }

  /**
   * Set an item into the cache
   * @param maxAge Max age in ms
   * @returns
   */
  async set(id: string, entry: unknown, maxAge?: number) {
    const entryText = CacheUtil.toSafeJSON(entry);

    const store = await this.modelService.upsert(CacheType,
      CacheType.from({
        id,
        entry: entryText!,
        expiresAt: new Date(maxAge ? maxAge + Date.now() : INFINITE_MAX_AGE),
        issuedAt: new Date()
      }),
    );

    return CacheUtil.fromSafeJSON(store.entry);
  }

  async delete(id: string) {
    await this.modelService.delete(CacheType, id);
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