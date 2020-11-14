import * as redis from 'redis';
import * as util from 'util';

import { ShutdownManager, Util } from '@travetto/base';
import { ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelType } from '@travetto/model-core';
import { Class } from '@travetto/registry';

import { RedisModelConfig } from './config';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { Injectable } from '../../rest/node_modules/@travetto/di';

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelExpirySupport {

  cl: redis.RedisClient;

  constructor(private config: RedisModelConfig) { }

  private resolveKey(cls: Class, id?: string) {
    const key = `${ModelRegistry.getStore(cls)}:`;
    return id ? `${key}${id}` : key;
  }

  async postConstruct() {
    this.cl = new redis.RedisClient(this.config.client);
    ShutdownManager.onShutdown(__filename, () => this.cl.quit());
  }

  uuid(): string {
    return Util.uuid();
  }

  async getOptional<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const payload = await util.promisify(this.cl.get)(this.resolveKey(cls, id));
      return ModelCrudUtil.load(cls, payload);
    } catch (err) {
      return;
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const item = await this.getOptional(cls, id);
    if (!item) {
      throw ModelCrudUtil.notFoundError(cls, id);
    }
    return item;
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (await this.getOptional(cls, item.id!)) {
      throw ModelCrudUtil.existsError(cls, item.id!);
    }
    return this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.get(cls, item.id!); // Ensure it exists
    return this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await util.promisify(this.cl.set)(this.resolveKey(cls, item.id), JSON.stringify(item));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));
    await util.promisify(this.cl.set)(this.resolveKey(cls, item.id), JSON.stringify(item));
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const count = await util.promisify(this.cl.del as (key: string, cb: redis.Callback<number>) => void)(this.resolveKey(cls, id));
    if (count === 0) {
      throw ModelCrudUtil.notFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    let prevCursor: string | undefined;
    let done = false;
    while (!done) {
      const [cursor, results] = await util.promisify(
        this.cl.scan as
        (cursorNum: string, matchOp: 'MATCH', match: string, countOp: 'COUNT', count: string, cb: redis.Callback<[string, string[]]>) => void
      )(prevCursor ?? '0', 'MATCH', `${this.resolveKey(cls)}:*`, 'COUNT', '500');
      prevCursor = cursor;
      for (const el of results) {
        yield this.get(cls, el);
      }
      if (cursor === '0') {
        done = true;
      }
    }
  }

  updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
  upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number): Promise<T> {
    throw new Error('Method not implemented.');
  }
  getExpiry<T extends ModelType>(cls: Class<T>, id: string): Promise<ExpiryState> {
    throw new Error('Method not implemented.');
  }
  deleteExpired?<T extends ModelType>(cls: Class<T>): Promise<number> {
    throw new Error('Method not implemented.');
  }


  // async get(cls: Class<T>, key: string): Promise<CacheEntry | undefined> {

  //   const val: any = await this.toPromise(this.cl.get.bind(this.cl, key));
  //   if (val) {
  //     return CacheSourceUtil.readAsSafeJSON(val);
  //   }
  // }

  // async has(key: string): Promise<boolean> {
  //   return !!(await this.toPromise(this.cl.exists.bind(this.cl, key)));
  // }

  // async set(key: string, entry: CacheEntry): Promise<any> {
  //   if (entry.maxAge) {
  //     entry.expiresAt = entry.maxAge + Date.now();
  //   }
  //   const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

  //   await this.toPromise(this.cl.setnx.bind(this.cl, key, cloned));

  //   if (entry.expiresAt) {
  //     await this.touch(key, entry.expiresAt);
  //   }

  //   return CacheSourceUtil.readAsSafeJSON(cloned);
  // }

  // async delete(key: string): Promise<boolean> {
  //   return !!(await this.toPromise(this.cl.del.bind(this.cl, key)));
  // }

  // async isExpired(key: string) {
  //   return !(await this.has(key));
  // }

  // async touch(key: string, expiresAt: number): Promise<boolean> {
  //   return !!(await this.toPromise(this.cl.pexpireat.bind(this.cl, key, expiresAt)));
  // }

  // async clear() {
  //   await this.toPromise(this.cl.flushall.bind(this.cl));
  // }

  // async keys() {
  //   return await this.toPromise(this.cl.keys.bind(this.cl, '*'));
  // }
}