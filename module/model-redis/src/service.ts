import { createClient } from '@redis/client';

import { castTo, JSONUtil, ShutdownManager, type Any, type Class } from '@travetto/runtime';
import {
  type ModelCrudSupport, type ModelExpirySupport, ModelRegistryIndex, type ModelType, type ModelStorageSupport,
  NotFoundError, ExistsError, type ModelIndexedSupport, type OptionalId, type ListPageOptions,
  ModelCrudUtil, ModelExpiryUtil, ModelIndexedUtil, ModelStorageUtil,
  type ListPageResult,
  type KeyedIndexBody,
  type UniqueIndex,
  type KeyedIndexSelection,
  type KeyedIndexWithPartialBody,
  type KeyedIndex,
  type SortedIndexSelection,
  type SortedIndex,
  type SortedKeyedIndex,
  isModelIndexedIndex,
} from '@travetto/model';
import { Injectable, PostConstruct } from '@travetto/di';

import type { RedisModelConfig } from './config.ts';

type RedisScan = ({ key: string } | { match: string }) & { reverse?: boolean };
type RedisClient = ReturnType<typeof createClient>;
type RedisMulti = ReturnType<RedisClient['multi']>;
type ScanState = { cursor?: string, ids: string[] };
type ScanOp = 'scan' | 'sScan' | 'zRange';

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  idSource = ModelCrudUtil.uuidSource();
  client: RedisClient;
  config: RedisModelConfig;

  constructor(config: RedisModelConfig) { this.config = config; }

  #resolveKey(cls: Class | string, id?: string, extra?: string): string {
    let key = typeof cls === 'string' ? cls : ModelRegistryIndex.getStoreName(cls);
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

  async #scan(operation: ScanOp, cursor: string, search: RedisScan, count = 100): Promise<ScanState> {
    const key = 'key' in search ? search.key : '';
    const flags = { COUNT: count, ...('match' in search ? { MATCH: search.match } : {}) };

    let output: ScanState;
    switch (operation) {
      case 'scan': output = await this.client.scan(cursor ?? '0', flags).then(result => ({ cursor: result.cursor, ids: result.keys })); break;
      case 'sScan': output = await this.client.sScan(key!, cursor ?? '0', flags).then(result => ({ cursor: result.cursor, ids: result.members })); break;
      case 'zRange': {
        const offset = cursor ? +cursor : 0;
        const bounds: [number, number] = search.reverse ?
          [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY] :
          [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
        const result = await this.client.zRange(key!, ...bounds, { BY: 'SCORE', REV: search.reverse, LIMIT: { offset, count } });
        output = { cursor: result.length ? (offset + result.length).toString() : undefined, ids: result };
        break;
      }
    }
    return { ...output, cursor: output.cursor === '0' ? undefined : output.cursor };
  }

  async * #streamValues(
    operation: ScanOp, search: RedisScan, options: ListPageOptions, count = 10
  ): AsyncIterable<ScanState> {
    const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
    let matched: ScanState = { cursor: options.offset, ids: [] };
    let produced = 0;

    do {
      const remaining = limit - produced;
      matched = await this.#scan(operation, matched.cursor!, search, Math.min(remaining, count));
      yield matched;
      produced += matched.ids.length;
    } while (matched.cursor && produced < limit);
  }

  #scanIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
  >(
    cls: Class<T>,
    idx: KeyedIndex<T, K> | SortedIndex<T, Any> | SortedKeyedIndex<T, K, Any>,
    body: KeyedIndexBody<T, K>, options: ListPageOptions
  ): AsyncIterable<ScanState> {
    ModelCrudUtil.ensureNotSubType(cls);
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, castTo(body), { emptySortValue: null });
    const fullKey = this.#resolveKey(cls, idx.name, key);
    switch (idx.type) {
      case 'indexed:keyed': return this.#streamValues('sScan', { key: fullKey }, options);
      case 'indexed:sortedKeyed':
      case 'indexed:sorted': {
        const reverse = 'reversed' in idx && idx.reversed;
        return this.#streamValues('zRange', { key: fullKey, reverse }, options);
      }
    }
  }

  async * #getBodies<T extends ModelType>(cls: Class<T>, ids: string[], transform: (id: string) => string): AsyncIterable<T> {
    if (ids.length === 0) {
      return;
    }
    const bodies = (await this.client.mGet(ids.map(transform)))
      .filter((result): result is string => !!result);
    for (const body of bodies) {
      try {
        yield await ModelCrudUtil.load(cls, body);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
  }

  #removeIndices<T extends ModelType>(cls: Class, item: T, multi: RedisMulti): void {
    for (const idx of Object.values(ModelRegistryIndex.getIndices(cls))) {
      if (isModelIndexedIndex(idx)) {
        const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
        const fullKey = this.#resolveKey(cls, idx.name, key);
        switch (idx.type) {
          case 'indexed:keyed': multi.sRem(fullKey, item.id); break;
          case 'indexed:sortedKeyed':
          case 'indexed:sorted': multi.zRem(fullKey, item.id); break;
        }
      }
    }
  }

  #addIndices<T extends ModelType>(cls: Class, item: T, multi: RedisMulti): void {
    for (const idx of Object.values(ModelRegistryIndex.getIndices(cls))) {
      if (isModelIndexedIndex(idx)) {
        const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
        const fullKey = this.#resolveKey(cls, idx.name, key);

        switch (idx.type) {
          case 'indexed:keyed': multi.sAdd(fullKey, item.id); break;
          case 'indexed:sortedKeyed':
          case 'indexed:sorted': multi.zAdd(fullKey, { score: +sort!, value: item.id }); break;
        }
      }
    }
  }

  async #store<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'delete'): Promise<void> {
    const key = this.#resolveKey(cls, item.id);
    const config = ModelRegistryIndex.getConfig(cls);
    const existing = await this.get(cls, item.id).catch(() => undefined);

    // Store with indices
    if (config.indices?.length) {
      const multi = this.client.multi();
      if (existing) {
        this.#removeIndices(cls, existing, multi);
      }
      switch (action) {
        case 'write': {
          multi.set(key, JSONUtil.toUTF8(item));
          this.#addIndices(cls, item, multi);
          break;
        }
        case 'delete': {
          multi.del(key);
          break;
        }
      }
      await multi.exec();
    } else {
      switch (action) {
        case 'write': {
          await this.client.set(key, JSONUtil.toUTF8(item));
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

  async #getIdByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: UniqueIndex<T, K> | KeyedIndex<T, K> | SortedIndex<T, Any> | SortedKeyedIndex<T, K, Any>,
    body: KeyedIndexBody<T, K>
  ): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, castTo(body));
    const fullKey = this.#resolveKey(cls, idx.name, key);
    let id: string | undefined;
    switch (idx.type) {
      case 'indexed:keyed': id = await this.client.sRandMember(fullKey) ?? undefined; break;
      case 'indexed:sortedKeyed':
      case 'indexed:sorted': {
        const result = await this.client.zRangeByScore(fullKey, +sort!, +sort!);
        id = result[0];
        break;
      }
    }
    if (id) {
      return id;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, key);
  }

  @PostConstruct()
  async initializeClient(): Promise<void> {
    this.client = createClient(this.config.client);
    await this.client.connect();
    await ModelStorageUtil.storageInitialization(this);
    ShutdownManager.signal.addEventListener('abort', () => this.client.close());
    for (const cls of ModelRegistryIndex.getClasses()) {
      for (const idx of ModelRegistryIndex.getIndices(cls)) {
        if (!isModelIndexedIndex(idx) || idx.type === 'indexed:unique') {
          console.warn('Non-indexed indices are not supported in redis for', { cls: cls.Ⲑid, idx: idx.name });
        }
      }
    }
  }

  async has<T extends ModelType>(cls: Class<T>, id: string, error?: 'notfound' | 'exists'): Promise<void> {
    const result = await this.client.exists(this.#resolveKey(cls, id));
    if (result === 0 && error === 'notfound') {
      throw new NotFoundError(cls, id);
    } else if (result === 1 && error === 'exists') {
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
      await this.has(cls, item.id, 'exists');
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
    const updated = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    await this.#store(cls, updated, 'write');
    return updated;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);
    const where: ModelType = { id };
    await this.#store(cls, where, 'delete');
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const { ids } of this.#streamValues('scan', { match: `${this.#resolveKey(cls)}:*` }, { limit: Number.MAX_SAFE_INTEGER })) {
      yield* this.#getBodies(cls, ids, id => id);
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(_cls: Class<T>): Promise<number> {
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
      for await (const { ids } of this.#streamValues('scan', { match: `${this.#resolveKey('')}*` }, { limit: Number.MAX_SAFE_INTEGER })) {
        if (ids.length) {
          await this.client.del(ids);
        }
      }
    }
  }

  async truncateModel<T extends ModelType>(model: Class<T>): Promise<void> {
    for await (const { ids } of this.#streamValues('scan', { match: `${this.#resolveKey(model)}:*` }, { limit: Number.MAX_SAFE_INTEGER })) {
      if (ids.length) {
        await this.client.del(ids);
      }
    }
  }

  // Indexed

  async getByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: UniqueIndex<T, K> | KeyedIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: UniqueIndex<T, K> | KeyedIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }


  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>>(
    cls: Class<T>,
    idx: UniqueIndex<T, K>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  updateByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: UniqueIndex<T, K>, body: T): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: UniqueIndex<T, K>, body: KeyedIndexWithPartialBody<T, K>): Promise<T> {
    const item = await ModelCrudUtil.naivePartialUpdate(cls, () => this.getByIndex(cls, idx, body), castTo(body));
    return this.update(cls, item);
  }

  listByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SortedKeyedIndex<T, K, S>, options: ListPageOptions & { body: KeyedIndexBody<T, K> }): Promise<ListPageResult<T>>;
  listByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SortedIndex<T, S>, options: ListPageOptions): Promise<ListPageResult<T>>;
  async listByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedKeyedIndex<T, Any, S> | SortedIndex<T, S>,
    options: ListPageOptions & { body?: Any },
  ): Promise<ListPageResult<T>> {
    const items: T[] = [];
    let lastCursor: string | undefined;
    for await (const { ids, cursor } of this.#scanIndex(cls, idx, options.body, options)) {
      items.push(
        ...await Array.fromAsync(this.#getBodies(cls, ids, id => this.#resolveKey(cls, id)))
      );
      lastCursor = cursor;
    }
    return { items, nextOffset: lastCursor };
  }
}