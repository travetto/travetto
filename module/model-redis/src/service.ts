import * as redis from 'redis';
import * as util from 'util';

import { ShutdownManager, Util } from '@travetto/base';
import { ModelCrudSupport, ModelExpirySupport, ModelRegistry, ExpiryState, ModelType, ModelStorageSupport, Model } from '@travetto/model-core';
import { Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';

import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model-core/src/internal/service/expiry';

import { RedisModelConfig } from './config';

@Model()
class ExpiryMeta implements ModelType, ExpiryState {

  id?: string;
  issuedAt: number;
  expiresAt: number;

  get maxAge() {
    return this.expiresAt - this.issuedAt;
  }

  get expired() {
    return this.expiresAt < Date.now();
  }

  toJSON() {
    return { issuedAt: this.issuedAt, expiresAt: this.expiresAt };
  }
}

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport {

  cl: redis.RedisClient;

  constructor(private config: RedisModelConfig) { }

  private wrap = <T>(fn: T): T => (fn as any).bind(this.cl) as T;

  private resolveKey(cls: Class, id?: string) {
    const key = `${ModelRegistry.getBaseStore(cls)}:${ModelRegistry.getStore(cls)}`;
    return id ? `${key}:${id}` : key;
  }

  async postConstruct() {
    this.cl = new redis.RedisClient(this.config.client);
    ShutdownManager.onShutdown(__filename, () => this.cl.quit());
  }

  uuid(): string {
    return Util.uuid();
  }

  async has<T extends ModelType>(cls: Class<T>, id: string, error?: 'notfound' | 'data') {
    const res = await this.wrap(util.promisify(this.cl.exists as (key: string, cb: redis.Callback<number>) => void))(this.resolveKey(cls, id));
    if (res === 0 && error === 'notfound') {
      throw ModelCrudUtil.notFoundError(cls, id);
    } else if (res === 1 && error === 'data') {
      throw ModelCrudUtil.existsError(cls, id);
    }
  }

  async getOptional<T extends ModelType>(cls: Class<T>, id: string) {
    const payload = await this.wrap(util.promisify(this.cl.get))(this.resolveKey(cls, id));
    if (payload) {
      return await ModelCrudUtil.load(cls, payload);
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
    await this.has(cls, item.id!, 'data');
    return this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.has(cls, item.id!, 'notfound');
    return this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.wrap(util.promisify(this.cl.set))(this.resolveKey(cls, item.id), JSON.stringify(item));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.wrap(util.promisify(this.cl.set))(this.resolveKey(cls, item.id), JSON.stringify(item));
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const count = await this.wrap(util.promisify(this.cl.del as (key: string, cb: redis.Callback<number>) => void))(this.resolveKey(cls, id));
    if (count === 0) {
      throw ModelCrudUtil.notFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    let prevCursor: string | undefined;
    let done = false;
    while (!done) {
      const [cursor, results] = await this.wrap(util.promisify(
        this.cl.scan as
        (cursorNum: string, matchOp: 'MATCH', match: string, countOp: 'COUNT', count: string, cb: redis.Callback<[string, string[]]>) => void
      ))(prevCursor ?? '0', 'MATCH', `${this.resolveKey(cls)}:*`, 'COUNT', '100');
      prevCursor = cursor;
      if (results.length) {
        const values = await this.wrap(util.promisify(this.cl.mget as (keys: string[], cb: redis.Callback<(string | null)[]>) => void))(results);
        for (const el of values) {
          if (el) {
            const loaded = await ModelCrudUtil.load(cls, el);
            if (loaded) {
              yield loaded;
            }
          }
        }
      }
      if (cursor === '0') {
        done = true;
      }
    }
  }

  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    const expires = ModelExpiryUtil.getExpiresAt(ttl);
    const updated = await this.wrap(util.promisify(this.cl.pexpireat))(
      this.resolveKey(cls, id), expires.getTime()
    );

    // Store expiry and mark for deletion
    const expireKey = `expiry-${this.resolveKey(cls, id)}`;
    await this.wrap(util.promisify(this.cl.set))(expireKey,
      JSON.stringify(({ expiresAt: expires.getTime(), issuedAt: Date.now() }))
    );
    // await this.wrap(util.promisify(this.cl.pexpireat))(expireKey, expires.getTime());

    if (!updated) {
      throw ModelCrudUtil.notFoundError(cls, id);
    }
  }

  async upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number) {
    const { id } = await this.upsert(cls, item);
    await this.updateExpiry(cls, id!, ttl);
    return item;
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const expireKey = `expiry-${this.resolveKey(cls, id)}`;
    const content = await this.wrap(util.promisify(this.cl.get))(expireKey);
    if (content) {
      return ModelCrudUtil.load(ExpiryMeta, content);
    } else {
      throw ModelCrudUtil.notFoundError(cls, id);
    }
  }

  async createStorage() {
    // Do nothing
  }

  async deleteStorage() {
    await this.wrap(util.promisify(this.cl.flushdb))();
  }
}