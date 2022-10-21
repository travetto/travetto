import * as redis from 'redis';

import { Class, ShutdownManager } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelType, ModelStorageSupport,
  NotFoundError, ExistsError, ModelIndexedSupport, OptionalId
} from '@travetto/model';
import { Injectable } from '@travetto/di';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelUtil } from '@travetto/model/src/internal/util';

import { RedisModelConfig } from './config';

type RedisScan = { key: string } | { match: string };
type RedisClient = ReturnType<typeof redis.createClient>;
type RedisMulti = ReturnType<RedisClient['multi']>;

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  client: RedisClient;

  constructor(public readonly config: RedisModelConfig) { }

  #resolveKey(cls: Class | string, id?: string, extra?: string): string {
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

  async * #streamValues(op: 'scan' | 'sScan' | 'zScan', search: RedisScan, count = 100): AsyncIterable<string[]> {
    let prevCursor = 0;
    let done = false;

    const flags = { COUNT: count, ...('match' in search ? { MATCH: search.match } : {}) };
    const key = 'key' in search ? search.key : '';

    while (!done) {
      const [cursor, results] = await (
        op === 'scan' ?
          this.client.scan(prevCursor, flags).then(x => [x.cursor, x.keys] as const) :
          op === 'sScan' ?
            this.client.sScan(key, prevCursor, flags).then(x => [x.cursor, x.members] as const) :
            this.client.zScan(key, prevCursor, flags).then(x => [x.cursor, x.members.map(y => y.value)] as const)
      );

      prevCursor = cursor;

      yield results;

      if (cursor === 0) {
        done = true;
      }
    }
  }

  #iterate(prefix: Class | string): AsyncIterable<string[]> {
    return this.#streamValues('scan', { match: `${this.#resolveKey(prefix)}*` });
  }

  #removeIndices<T extends ModelType>(cls: Class, item: T, multi: RedisMulti): void {
    for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
      const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
      const fullKey = this.#resolveKey(cls, idx.name, key);
      switch (idx.type) {
        case 'unsorted': multi.sRem(fullKey, item.id); break;
        case 'sorted': multi.zRem(fullKey, item.id); break;
      }
    }
  }

  #addIndices<T extends ModelType>(cls: Class, item: T, multi: RedisMulti): void {
    for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
      const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
      const fullKey = this.#resolveKey(cls, idx.name, key);

      switch (idx.type) {
        case 'unsorted': multi.sAdd(fullKey, item.id); break;
        case 'sorted': multi.zAdd(fullKey, { score: +sort!, value: item.id }); break;
      }
    }
  }

  async #store<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'delete'): Promise<void> {
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
      await multi.exec();
    } else {
      switch (action) {
        case 'write': {
          await this.client.set(key, JSON.stringify(item));
          break;
        }
        case 'delete': {
          const count = await this.client.del(this.#resolveKey(cls, item.id));
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
          await this.client.pExpireAt(
            this.#resolveKey(cls, item.id), expiry.expiresAt.getTime()
          );
        } else {
          await this.client.persist(this.#resolveKey(cls, item.id));
        }
      }
    }
  }

  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const idxCfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idxCfg, body);
    const fullKey = this.#resolveKey(cls, idxCfg.name, key);
    let id: string | undefined;
    if (idxCfg.type === 'unsorted') {
      id = (await this.client.sRandMember(fullKey))!;
    } else {
      const res = await this.client.zRangeByScore(
        fullKey, +sort!, +sort!
      );
      id = res[0];
    }
    if (id) {
      return id;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, key);
  }

  async postConstruct(): Promise<void> {
    this.client = redis.createClient(this.config.client);
    await this.client.connect();
    await ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onShutdown(this.constructor.Ⲑid, () => this.client.disconnect());
    for (const el of ModelRegistry.getClasses()) {
      for (const idx of ModelRegistry.get(el).indices ?? []) {
        switch (idx.type) {
          case 'unique': {
            console.error('Unique indices are not supported in redis for', { cls: el.Ⲑid, idx: idx.name });
            break;
          }
        }
      }
    }
  }

  uuid(): string {
    return ModelUtil.uuid(32);
  }

  async has<T extends ModelType>(cls: Class<T>, id: string, error?: 'notfound' | 'data'): Promise<void> {
    const res = await this.client.exists(this.#resolveKey(cls, id));
    if (res === 0 && error === 'notfound') {
      throw new NotFoundError(cls, id);
    } else if (res === 1 && error === 'data') {
      throw new ExistsError(cls, id);
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const payload = await this.client.get(this.#resolveKey(cls, id));
    if (payload) {
      const item = await ModelCrudUtil.load(cls, payload);
      if (item) {
        return item;
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    if (item.id) {
      await this.has(cls, item.id, 'data');
    }
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    await this.has(cls, item.id, 'notfound');
    return this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    const updated = await ModelCrudUtil.naivePartialUpdate(cls, item, view, (): Promise<T> => this.get(cls, id));
    await this.#store(cls, updated, 'write');
    return updated;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);
    const where: ModelType = { id };
    await this.#store(cls, where, 'delete');
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const ids of this.#iterate(cls)) {

      if (!ids.length) {
        return;
      }

      const bodies = (await this.client.mGet(ids))
        .filter((x): x is string => !!x);

      for (const body of bodies) {
        try {
          yield await ModelCrudUtil.load(cls, body);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
      }
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    // Automatic
    return -1;
  }

  // Storage
  async createStorage(): Promise<void> {
    // Do nothing
  }

  async deleteStorage(): Promise<void> {
    if (!this.config.namespace) {
      await this.client.flushDb();
    } else {
      for await (const ids of this.#iterate('')) {
        if (ids.length) {
          await this.client.del(ids);
        }
      }
    }
  }

  async truncateModel<T extends ModelType>(model: Class<T>): Promise<void> {
    for await (const ids of this.#iterate(model)) {
      if (ids.length) {
        await this.client.del(ids);
      }
    }
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const idxCfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);

    let stream: AsyncIterable<string[]>;

    const { key } = ModelIndexedUtil.computeIndexKey(cls, idxCfg, body, { emptySortValue: null });
    const fullKey = this.#resolveKey(cls, idx, key);

    if (idxCfg.type === 'unsorted') {
      stream = this.#streamValues('sScan', { key: fullKey });
    } else {
      stream = this.#streamValues('zScan', { key: fullKey });
    }

    for await (const ids of stream) {
      if (!ids.length) {
        return;
      }

      const bodies = (await this.client.mGet(
        ids.map(x => this.#resolveKey(cls, x))
      ))
        .filter((x): x is string => !!x);

      for (const full of bodies) {
        try {
          yield await ModelCrudUtil.load(cls, full);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
      }
    }
  }
}