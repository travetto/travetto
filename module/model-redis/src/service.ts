import * as redis from 'redis';
import * as util from 'util';

import { Class, ShutdownManager, Util } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelType, ModelStorageSupport,
  NotFoundError, ExistsError, ModelIndexedSupport, SubTypeNotSupportedError,
  IndexConfig, OptionalId
} from '@travetto/model';
import { Injectable } from '@travetto/di';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { RedisModelConfig } from './config';

type RedisScan = { key: string } | { match: string };

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  client: redis.RedisClient;

  constructor(public readonly config: RedisModelConfig) { }

  #wrap = <T>(fn: T): T => (fn as unknown as Function).bind(this.client) as T;

  #resolveKey(cls: Class | string, id?: string, extra?: string) {
    let key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    if (id) {
      key = `${key}:${id}`;
    }
    if (extra) {
      key = `${key}:${extra}`;
    }
    if (this.config.namespace) {
      key = `${this.config.namespace}/${key}`;
    }
    return key;
  }

  async * #streamValues(op: 'scan' | 'sscan' | 'zscan', search: RedisScan, count = 100): AsyncIterable<string[]> {
    let prevCursor: string | undefined;
    let done = false;

    const flags = 'match' in search ? ['MATCH', search.match] : [];
    const key = 'key' in search ? [search.key] : [];

    while (!done) {
      const [cursor, results] = await this.#wrap(util.promisify(this.client[op]) as ((...rest: string[]) => Promise<[string, string[]]>))(
        ...key, prevCursor ?? '0', ...flags, 'COUNT', `${count}`
      );
      prevCursor = cursor;
      if (results.length) {
        if (op === 'zscan') {
          yield results.filter((x, i) => i % 2 === 0); // Drop scores
        } else {
          yield results;
        }
      }
      if (cursor === '0') {
        done = true;
      }
    }
  }

  #iterate(prefix: Class | string): AsyncIterable<string[]> {
    return this.#streamValues('scan', { match: `${this.#resolveKey(prefix)}*` });
  }

  #removeIndices<T extends ModelType>(cls: Class, item: T, multi: redis.Multi) {
    for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
      const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
      const fullKey = this.#resolveKey(cls, idx.name, key);
      switch (idx.type) {
        case 'unsorted': multi.srem(fullKey, item.id); break;
        case 'sorted': multi.zrem(fullKey, item.id); break;
      }
    }
  }

  #addIndices<T extends ModelType>(cls: Class, item: T, multi: redis.Multi) {
    for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
      const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
      const fullKey = this.#resolveKey(cls, idx.name, key);

      switch (idx.type) {
        case 'unsorted': multi.sadd(fullKey, item.id); break;
        case 'sorted': multi.zadd(fullKey, +sort!, item.id); break;
      }
    }
  }

  async #store<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'delete') {
    const key = this.#resolveKey(cls, item.id);
    const config = ModelRegistry.get(cls);
    const existing = await this.get(cls, item.id).catch(() => undefined);

    // Store with indices
    if (config.indices?.length) {
      const multi = this.client.multi();
      switch (action) {
        case 'write': {
          if (existing) {
            this.#removeIndices(cls, existing, multi);
          }
          multi.set(key, JSON.stringify(item));
          this.#addIndices(cls, item, multi);
          break;
        }
        case 'delete': {
          this.#removeIndices(cls, existing!, multi);
          multi.del(key);
          break;
        }
      }
      await new Promise<void>((resolve, reject) => multi.exec(err => err ? reject(err) : resolve()));
    } else {
      switch (action) {
        case 'write': {
          await this.#wrap(util.promisify(this.client.set))(key, JSON.stringify(item));
          break;
        }
        case 'delete': {
          const count = await this.#wrap(util.promisify(this.client.del as (key2: string, cb: redis.Callback<number>) => void))(this.#resolveKey(cls, item.id));
          if (!count) {
            throw new NotFoundError(cls, item.id);
          }
        }
      }
    }

    // Set expiry
    if (action === 'write' && config.expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiry.expiresAt !== undefined) {
        if (expiry.expiresAt) {
          await this.#wrap(util.promisify(this.client.pexpireat))(
            this.#resolveKey(cls, item.id), expiry.expiresAt.getTime()
          );
        } else {
          await this.#wrap(util.promisify(this.client.persist))(this.#resolveKey(cls, item.id));
        }
      }
    }
  }

  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const idxCfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idxCfg, body);
    const fullKey = this.#resolveKey(cls, idxCfg.name, key);
    let id: string | undefined;
    if (idxCfg.type === 'unsorted') {
      id = await this.#wrap(util.promisify(this.client.srandmember) as (k: string) => Promise<string>)(fullKey);
    } else {
      const res = (await this.#wrap(util.promisify(this.client.zrangebyscore) as (k: string, start: string | number, end: string | number, type?: string) => Promise<string[]>)(
        fullKey, +sort!, +sort!
      ));
      id = res[0];
    }
    if (id) {
      return id;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, key);
  }

  async postConstruct() {
    this.client = new redis.RedisClient(this.config.client);
    await ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.quit());
    for (const el of ModelRegistry.getClasses()) {
      for (const idx of ModelRegistry.get(el).indices ?? []) {
        switch (idx.type) {
          case 'unique': {
            console.error('Unique inidices are not supported in redis for', { cls: el.ᚕid, idx: idx.name });
            break;
          }
        }
      }
    }
  }

  uuid() {
    return Util.uuid(32);
  }

  async has<T extends ModelType>(cls: Class<T>, id: string, error?: 'notfound' | 'data') {
    const res = await this.#wrap(util.promisify(this.client.exists as (key: string, cb: redis.Callback<number>) => void))(this.#resolveKey(cls, id));
    if (res === 0 && error === 'notfound') {
      throw new NotFoundError(cls, id);
    } else if (res === 1 && error === 'data') {
      throw new ExistsError(cls, id);
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const payload = await this.#wrap(util.promisify(this.client.get))(this.#resolveKey(cls, id));
    if (payload) {
      const item = await ModelCrudUtil.load(cls, payload);
      if (item) {
        return item;
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>) {
    if (item.id) {
      await this.has(cls, item.id, 'data');
    }
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    await this.has(cls, item.id, 'notfound');
    return this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.#store(cls, item as T, 'write');
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    await this.#store(cls, { id } as T, 'delete');
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const ids of this.#iterate(cls)) {

      const bodies = (await this.#wrap(util.promisify(this.client.mget as (keys: string[], cb: redis.Callback<(string | null)[]>) => void))(ids))
        .filter(x => !!x) as string[];

      for (const body of bodies) {
        try {
          yield await ModelCrudUtil.load(cls, body);
        } catch (e) {
          if (!(e instanceof NotFoundError)) {
            throw e;
          }
        }
      }
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    // Automatic
    return -1;
  }

  // Storage
  async createStorage() {
    // Do nothing
  }

  async deleteStorage() {
    if (!this.config.namespace) {
      await this.#wrap(util.promisify(this.client.flushdb))();
    } else {
      for await (const ids of this.#iterate('')) {
        if (ids.length) {
          await this.#wrap(util.promisify(this.client.del) as (...keys: string[]) => Promise<number>)(...ids);
        }
      }
    }
  }

  async truncateModel<T extends ModelType>(model: Class<T>) {
    for await (const ids of this.#iterate(model)) {
      if (ids.length) {
        await this.#wrap(util.promisify(this.client.del) as (...keys: string[]) => Promise<number>)(...ids);
      }
    }
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    const idxCfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);

    let stream: AsyncIterable<string[]>;

    const { key } = ModelIndexedUtil.computeIndexKey(cls, idxCfg as IndexConfig<T>, body, { emptySortValue: null });
    const fullKey = this.#resolveKey(cls, idx, key);

    if (idxCfg.type === 'unsorted') {
      stream = this.#streamValues('sscan', { key: fullKey });
    } else {
      stream = this.#streamValues('zscan', { key: fullKey });
    }

    for await (const ids of stream) {
      const bodies = (await this.#wrap(util.promisify(this.client.mget as (keys: string[], cb: redis.Callback<(string | null)[]>) => void))(
        ids.map(x => this.#resolveKey(cls, x))
      ))
        .filter(x => !!x) as string[];

      for (const full of bodies) {
        try {
          yield await ModelCrudUtil.load(cls, full);
        } catch (e) {
          if (!(e instanceof NotFoundError)) {
            throw e;
          }
        }
      }
    }
  }
}