import { createClient } from '@redis/client';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  ExistsError,
  type BulkResponse,
  type BulkSource,
  type ModelBulkSupport,
  ModelBulkUtil,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelExpirySupport,
  ModelExpiryUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  ModelStorageUtil,
  type ModelType,
  NotFoundError,
  type OptionalId,
  type PartialWithId
} from '@travetto/model';
import {
  type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody,
  isModelIndexedIndex,
  type KeyedIndexBody,
  type KeyedIndexSelection,
  ModelIndexedComputedIndex,
  type ModelIndexedSearchOptions,
  type ModelIndexedSupport,
  ModelIndexedUtil,
  type ModelPageOptions,
  type ModelPageResult,
  type SingleItemIndex,
  type SortedIndex,
  type SortedIndexSelection,
  warnIfIndexedUniqueIndex,
  warnIfNonIndexedIndex
} from '@travetto/model-indexed';
import { type Class, castTo, JSONUtil, ShutdownManager } from '@travetto/runtime';

import type { RedisModelConfig } from './config.ts';

const TERMINATOR = '\xff';

type RedisScan = ({ key: string } | { match: string } | { prefix: string }) & { reverse?: boolean };
type RedisClient = ReturnType<typeof createClient>;
type RedisMulti = ReturnType<RedisClient['multi']>;
type ScanState = { cursor?: string; ids: string[] };
type ScanOp = 'scan' | 'sScan' | 'zRange';

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelBulkSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {
  client: RedisClient;
  config: RedisModelConfig;

  constructor(config: RedisModelConfig) {
    this.config = config;
  }

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
      case 'scan':
        output = await this.client.scan(cursor ?? '0', flags).then(result => ({ cursor: result.cursor, ids: result.keys }));
        break;
      case 'sScan':
        output = await this.client.sScan(key!, cursor ?? '0', flags).then(result => ({ cursor: result.cursor, ids: result.members }));
        break;
      case 'zRange': {
        const offset = cursor ? +cursor : 0;
        const prefix = 'prefix' in search ? search.prefix : undefined;

        let bounds: [number | string, number | string];

        if (prefix !== undefined) {
          bounds = [prefix ? `[${prefix}` : '-', `(${prefix}${TERMINATOR}`];
        } else {
          bounds = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
        }
        if (search.reverse) {
          bounds = [bounds[1], bounds[0]];
        }

        const result = await this.client.zRange(key!, ...bounds, {
          BY: prefix ? 'LEX' : 'SCORE',
          REV: search.reverse,
          LIMIT: { offset, count }
        });
        output = { cursor: result.length ? (offset + result.length).toString() : undefined, ids: result };
        break;
      }
    }
    return { ...output, cursor: output.cursor === '0' ? undefined : output.cursor };
  }

  async *#streamValues(operation: ScanOp, search: RedisScan, options?: ModelPageOptions & ModelListOptions): AsyncIterable<ScanState> {
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    let matched: ScanState = { cursor: options?.offset, ids: [] };
    let produced = 0;
    const batchSize = options?.batchSizeHint ?? 100;

    do {
      const remaining = limit - produced;
      matched = await this.#scan(operation, matched.cursor!, search, Math.min(remaining, batchSize));
      if (matched.ids.length) {
        yield matched;
        produced += matched.ids.length;
      }
    } while (matched.cursor && produced < limit && !options?.abort?.aborted);
  }

  #scanIndex<T extends ModelType>(
    cls: Class<T>,
    idx: SortedIndex<T>,
    body: KeyedIndexBody<T>,
    options?: ModelPageOptions & { prefix?: string }
  ): AsyncIterable<ScanState> {
    ModelCrudUtil.ensureNotSubType(cls);
    const computed = ModelIndexedComputedIndex.get(idx, body).validate();
    const fullKey = this.#resolveKey(cls, idx.name, computed.getKey());
    switch (idx.type) {
      // case 'indexed:keyed': return this.#streamValues('sScan', { key: fullKey }, options);
      case 'indexed:sorted': {
        return this.#streamValues('zRange', { key: fullKey, prefix: options?.prefix }, options);
      }
    }
  }

  async #getBodies<T extends ModelType>(cls: Class<T>, ids: string[], transform: (id: string) => string): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }
    const bodies = (await this.client.mGet(ids.map(transform))).filter((result): result is string => !!result);
    return ModelCrudUtil.filterOutNotFound(bodies.map(body => ModelCrudUtil.load(cls, body)));
  }

  #removeIndices<T extends ModelType>(cls: Class, item: T, multi: RedisMulti): void {
    const id = ModelRegistryIndex.get(cls).idSource.get(item);
    for (const idx of ModelRegistryIndex.getIndices(cls)) {
      if (isModelIndexedIndex(idx)) {
        const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
        const resolvedKey = this.#resolveKey(cls, idx.name, computed.getKey());
        switch (idx.type) {
          case 'indexed:keyed':
            multi.sRem(resolvedKey, id);
            break;
          case 'indexed:sorted':
            multi.zRem(resolvedKey, id);
            break;
        }
      }
    }
  }

  #addIndices<T extends ModelType>(cls: Class, item: T, multi: RedisMulti): void {
    const id = ModelRegistryIndex.get(cls).idSource.get(item);
    for (const idx of ModelRegistryIndex.getIndices(cls)) {
      if (isModelIndexedIndex(idx)) {
        const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
        const resolvedKey = this.#resolveKey(cls, idx.name, computed.getKey());

        switch (idx.type) {
          case 'indexed:keyed':
            multi.sAdd(resolvedKey, id);
            break;
          case 'indexed:sorted': {
            const value = computed.getSort();
            if (typeof value === 'string') {
              multi.zAdd(resolvedKey, { score: 0, value: `${value}${TERMINATOR}${id}` });
            } else {
              multi.zAdd(resolvedKey, { score: computed.getSort(), value: id });
            }
            break;
          }
        }
      }
    }
  }

  async #store<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'delete'): Promise<void> {
    const id = ModelRegistryIndex.get(cls).idSource.get(item);
    const key = this.#resolveKey(cls, id);
    const config = ModelRegistryIndex.getConfig(cls);
    const indices = ModelRegistryIndex.getIndices(cls);
    const existing = await this.get(cls, id).catch(() => undefined);

    // Store with indices
    if (indices.length) {
      const multi = this.client.multi();
      if (existing) {
        this.#removeIndices(cls, existing, multi);
      } else if (action === 'delete') {
        throw new NotFoundError(cls, id);
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
          const count = await this.client.del(this.#resolveKey(cls, id));
          if (!count) {
            throw new NotFoundError(cls, id);
          }
        }
      }
    }

    // Set expiry
    if (action === 'write' && config.expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiry.expiresAt !== undefined) {
        if (expiry.expiresAt) {
          await this.client.pExpireAt(this.#resolveKey(cls, id), expiry.expiresAt.getTime());
        } else {
          await this.client.persist(this.#resolveKey(cls, id));
        }
      }
    }
  }

  async #getIdByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });
    const resolvedKey = this.#resolveKey(cls, idx.name, computed.getKey());
    let id: string | undefined;
    switch (idx.type) {
      case 'indexed:keyed': {
        if (computed.idPart) {
          const all = await this.client.sMembers(resolvedKey);
          if (!all.find(item => item === computed.idPart!.value)) {
            throw new NotFoundError(`${cls.name} Index=${idx}`, computed.getKey());
          }
          id = computed.idPart!.value;
        } else {
          id = (await this.client.sRandMember(resolvedKey)) ?? undefined;
        }
        break;
      }
      case 'indexed:sorted': {
        const sort = computed.getSort();
        const result = await this.client.zRangeByScore(resolvedKey, sort, sort);
        if (computed.idPart) {
          if (!result.find(item => item === computed.idPart!.value)) {
            throw new NotFoundError(`${cls.name} Index=${idx}`, computed.getKey());
          }
          id = computed.idPart!.value;
        } else {
          id = result[0];
        }
        break;
      }
    }
    if (id) {
      return id;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, computed.getKey({ sort: true }));
  }

  @PostConstruct()
  async initializeClient(): Promise<void> {
    this.client = createClient(this.config.client);
    await this.client.connect();
    await ModelStorageUtil.storageInitialization(this);
    ShutdownManager.signal.addEventListener('abort', () => this.client.close());
    for (const cls of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, cls, ModelRegistryIndex.getIndices(cls));
      warnIfNonIndexedIndex(this, cls, ModelRegistryIndex.getIndices(cls));
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
    const id = ModelRegistryIndex.get(cls).idSource.get(item, { optional: true });
    if (id) {
      await this.has(cls, id, 'exists');
    }
    const prepped = await ModelCrudUtil.preCreate(cls, item);
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    const prepped = await ModelCrudUtil.preUpdate(cls, item, {
      ensureNotSubType: true,
      getOperation: id => this.has(cls, id, 'notfound'),
      readBeforeUpdate: this.config.readBeforeUpdate
    });
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preUpsert(cls, item, { ensureNotSubType: true });
    await this.#store(cls, prepped, 'write');
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: PartialWithId<T>): Promise<T> {
    const id = ModelRegistryIndex.get(cls).idSource.get(item);
    const prepared = await ModelCrudUtil.prePartialUpdate(cls, item, {
      ensureNotSubType: true
    });
    const updated = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), prepared, id);
    await this.#store(cls, updated, 'write');
    return updated;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    id = await ModelCrudUtil.preDelete(cls, id, { ensureNotSubType: true });
    const where: ModelType = {};
    ModelRegistryIndex.get(cls).idSource.set(castTo(where), id);
    await this.#store(cls, castTo<T>(where), 'delete');
  }

  async *list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const { ids } of this.#streamValues('scan', { match: `${this.#resolveKey(cls)}:*` }, options)) {
      yield await this.#getBodies(cls, ids, id => id);
    }
  }

  // Bulk
  processBulkStream<T extends ModelType>(cls: Class<T>, operations: BulkSource<T>, batchSize: number = 500): AsyncIterable<BulkResponse> {
    return ModelBulkUtil.processRawStream(cls, operations, batchSize, async ({ operations: resolvedOperations }) => {
      const idSource = ModelRegistryIndex.get(cls).idSource;
      const config = ModelRegistryIndex.getConfig(cls);

      const counts = {
        update: 0,
        insert: 0,
        upsert: 0,
        delete: 0,
        error: 0
      };
      const errors: unknown[] = [];
      const insertedIds = new Map<number, string>();

      // Check existing states for entities to validate existence and update indices
      const keys = resolvedOperations.map(operation => {
        const entity = operation.insert ?? operation.update ?? operation.upsert ?? operation.delete;
        return entity ? this.#resolveKey(cls, idSource.get(entity)) : '';
      });
      const existingRaw = await this.client.mGet(keys);
      const existingMap = new Map<number, T>();
      for (let index = 0; index < existingRaw.length; index += 1) {
        if (existingRaw[index]) {
          existingMap.set(index, await ModelCrudUtil.load(cls, existingRaw[index]!));
        }
      }

      const multi = this.client.multi();

      for (let index = 0; index < resolvedOperations.length; index += 1) {
        const operation = resolvedOperations[index];
        const existing = existingMap.get(index);
        const key = keys[index];

        try {
          if ('insert' in operation && operation.insert) {
            if (existing) {
              throw new ExistsError(cls, idSource.get(operation.insert));
            }
            multi.set(key, JSONUtil.toUTF8(operation.insert));
            this.#addIndices(cls, castTo<T>(operation.insert), multi);
            if (config.expiresAt) {
              const expiry = ModelExpiryUtil.getExpiryState(cls, castTo<T>(operation.insert));
              if (expiry.expiresAt !== undefined) {
                if (expiry.expiresAt) {
                  multi.pExpireAt(key, expiry.expiresAt.getTime());
                } else {
                  multi.persist(key);
                }
              }
            }
            counts.insert += 1;
            insertedIds.set(index, idSource.get(operation.insert));
          } else if ('update' in operation && operation.update) {
            if (!existing) {
              throw new NotFoundError(cls, idSource.get(operation.update));
            }
            this.#removeIndices(cls, existing, multi);
            multi.set(key, JSONUtil.toUTF8(operation.update));
            this.#addIndices(cls, operation.update, multi);
            if (config.expiresAt) {
              const expiry = ModelExpiryUtil.getExpiryState(cls, operation.update);
              if (expiry.expiresAt !== undefined) {
                if (expiry.expiresAt) {
                  multi.pExpireAt(key, expiry.expiresAt.getTime());
                } else {
                  multi.persist(key);
                }
              }
            }
            counts.update += 1;
          } else if ('upsert' in operation && operation.upsert) {
            if (existing) {
              this.#removeIndices(cls, existing, multi);
            }
            multi.set(key, JSONUtil.toUTF8(operation.upsert));
            this.#addIndices(cls, castTo<T>(operation.upsert), multi);
            if (config.expiresAt) {
              const expiry = ModelExpiryUtil.getExpiryState(cls, castTo<T>(operation.upsert));
              if (expiry.expiresAt !== undefined) {
                if (expiry.expiresAt) {
                  multi.pExpireAt(key, expiry.expiresAt.getTime());
                } else {
                  multi.persist(key);
                }
              }
            }
            if (!existing) {
              insertedIds.set(index, idSource.get(operation.upsert));
            }
            counts.upsert += 1;
          } else if ('delete' in operation && operation.delete) {
            if (!existing) {
              throw new NotFoundError(cls, idSource.get(operation.delete));
            }
            this.#removeIndices(cls, existing, multi);
            multi.del(key);
            counts.delete += 1;
          }
        } catch (error) {
          counts.error += 1;
          errors.push(typeof error === 'object' && error !== null ? Object.assign(error, { index }) : { index, error });
        }
      }

      await multi.exec();

      return { counts, errors, insertedIds };
    });
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkSource<T>, batchSize: number = 500): Promise<BulkResponse> {
    return ModelBulkUtil.collect(this.processBulkStream(cls, operations, batchSize));
  }

  // Expiry
  async deleteExpired<T extends ModelType>(_cls: Class<T>): Promise<number> {
    // Automatic
    return -1;
  }

  // Storage
  async createStorage(): Promise<void> {
    for (const cls of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, cls, ModelRegistryIndex.getIndices(cls));
      warnIfNonIndexedIndex(this, cls, ModelRegistryIndex.getIndices(cls));
    }
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

  async deleteModel<T extends ModelType>(model: Class<T>): Promise<void> {
    await this.truncateModel(model);
  }

  // Indexed

  async getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: T
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    const prepared = await ModelCrudUtil.prePartialUpdate(cls, castTo(body), { validateId: false });
    const item = await ModelCrudUtil.naivePartialUpdate(cls, () => this.getByIndex(cls, idx, castTo(body)), prepared);
    return this.update(cls, item);
  }

  async pageByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions
  ): Promise<ModelPageResult<T>> {
    const items: T[] = [];
    let lastCursor: string | undefined;
    for await (const { ids, cursor } of this.#scanIndex(cls, idx, body, { limit: 100, ...options })) {
      items.push(...(await this.#getBodies(cls, ids, id => this.#resolveKey(cls, id))));
      lastCursor = cursor;
    }
    return { items, nextOffset: lastCursor };
  }

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    for await (const { ids } of this.#scanIndex(cls, idx, body, options)) {
      yield await this.#getBodies(cls, ids, id => this.#resolveKey(cls, id));
    }
  }

  async suggestByIndex<T extends ModelType, S extends SortedIndexSelection<T>, K extends KeyedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    prefix: string,
    options?: ModelIndexedSearchOptions
  ): Promise<T[]> {
    const items: T[] = [];
    for await (const { ids } of this.#scanIndex(cls, idx, body, { limit: 10, ...options, prefix })) {
      const cleaned = ids.map(id => id.split(TERMINATOR).at(-1)!);
      items.push(...(await this.#getBodies(cls, cleaned, id => this.#resolveKey(cls, id))));
    }

    return items;
  }
}
