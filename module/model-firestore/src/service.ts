import { type DocumentData, FieldValue, Firestore, type Query } from '@google-cloud/firestore';

import { castTo, JSONUtil, ShutdownManager, type Class } from '@travetto/runtime';
import { Injectable, PostConstruct } from '@travetto/di';
import {
  type ModelCrudSupport, ModelRegistryIndex, type ModelStorageSupport, type ModelType, NotFoundError, type OptionalId, ModelCrudUtil,
  type ModelListOptions,
} from '@travetto/model';
import {
  type ModelIndexedSupport, type KeyedIndexSelection, type KeyedIndexBody, type ModelPageOptions, ModelIndexedUtil,
  type SingleItemIndex, type SortedIndexSelection, type ModelPageResult, type SortedIndex, type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody, ModelIndexedComputedIndex, warnIfIndexedUniqueIndex, warnIfNonIndexedIndex,
  type ModelIndexedSearchOptions
} from '@travetto/model-indexed';

import type { FirestoreModelConfig } from './config.ts';

const clone = JSONUtil.clone;
const setMissingValues = <T>(input: T, missingValue: unknown): T =>
  JSONUtil.clone(input, { replacer: (_, value) => value ?? null, reviver: (_, value) => value ?? missingValue });

/**
 * A model service backed by Firestore
 */
@Injectable()
export class FirestoreModelService implements ModelCrudSupport, ModelStorageSupport, ModelIndexedSupport {

  idSource = ModelCrudUtil.uuidSource();
  client: Firestore;
  config: FirestoreModelConfig;

  constructor(config: FirestoreModelConfig) { this.config = config; }

  #resolveTable(cls: Class): string {
    let table = ModelRegistryIndex.getStoreName(cls);
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  #getCollection(cls: Class): FirebaseFirestore.CollectionReference<DocumentData> {
    return this.client.collection(this.#resolveTable(cls));
  }

  async #getIdByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);
    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });
    const query = [...computed.allParts, ...(computed.idPart ? [computed.idPart] : [])].reduce<Query>(
      (result, { path, value }) => result.where(path.join('.'), '==', value),
      this.#getCollection(cls)
    );

    const item = await query.get();
    if (!item || item.empty) {
      throw new NotFoundError(`${cls.name} Index=${idx}`, computed.getKey());
    }
    return item.docs[0].id;
  }

  #buildIndexQuery<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>): Query {
    ModelCrudUtil.ensureNotSubType(cls);
    const computed = ModelIndexedComputedIndex.get(idx, body).validate();

    let query = computed.keyedParts.reduce<Query>((result, { path, value, state }) =>
      result.where(path.join('.'), '==', (state === 'empty' ? null : value)), this.#getCollection(cls));

    for (const { path, value } of idx.sortTemplate) {
      query = query.orderBy(path.join('.'), value === 1 ? 'asc' : 'desc');
    }
    return query;
  }

  async * #scanCollection<T extends ModelType>(
    cls: Class<T>,
    queryBuilder: () => Query,
    options?: ModelListOptions & ModelPageOptions<number>
  ): AsyncIterable<{ items: T[], nextOffset?: number }> {
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!(options?.abort?.aborted) && produced < limit) {
      const query = queryBuilder().limit(batchSize).offset(offset);

      let { docs } = await query.get();
      if (docs.length === 0) {
        break;
      }

      if (produced + docs.length > limit) {
        docs = docs.slice(0, limit - produced);
      }

      offset += docs.length;

      const items = await ModelCrudUtil.filterOutNotFound(
        docs.map(item => ModelCrudUtil.load(cls, item.data()!)));
      produced += items.length;

      yield { items, nextOffset: offset };
    }
  }

  @PostConstruct()
  async initializeClient(): Promise<void> {
    globalThis.devProcessWarningExclusions?.push((_, category) => category === 'MetadataLookupWarning');
    this.client = new Firestore({ ...this.config, useBigInt: true });
    ShutdownManager.signal.addEventListener('abort', () => this.client.terminate());
  }

  // Storage
  async createStorage(): Promise<void> {
    for (const cls of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, cls, ModelRegistryIndex.getIndices(cls));
      warnIfNonIndexedIndex(this, cls, ModelRegistryIndex.getIndices(cls));
    }
  }
  async deleteStorage(): Promise<void> { }

  async deleteModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    await this.client.recursiveDelete(this.#getCollection(cls));
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const result = await this.#getCollection(cls).doc(id).get();

    if (result && result.exists) {
      return await ModelCrudUtil.load(cls, result.data()!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(prepped.id).create(clone<DocumentData>(prepped));
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(item.id).set(clone<DocumentData>(prepped), { merge: false });
    return prepped;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(prepped.id).set(clone<DocumentData>(prepped));
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    const full = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    const cleaned = setMissingValues(full, FieldValue.delete());
    await this.#getCollection(cls).doc(id).set(cleaned, { mergeFields: Object.keys(full) });
    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);
    try {
      await this.#getCollection(cls).doc(id).delete({ exists: true });
    } catch (error) {
      if (error && error instanceof Error && error.message.includes('NOT_FOUND')) {
        throw new NotFoundError(cls, id);
      }
      throw error;
    }
  }

  async * list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const { items } of this.#scanCollection(cls, () => this.#getCollection(cls), options)) {
      yield items;
    }
  }

  // Indexed contract

  async getByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  updateByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: T): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexWithPartialBody<T, K, S>): Promise<T> {
    const item = await ModelCrudUtil.naivePartialUpdate(cls, () => this.getByIndex(cls, idx, castTo(body)), castTo(body));
    return this.update(cls, item);
  }

  async pageByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions,
  ): Promise<ModelPageResult<T>> {
    const items: T[] = [];
    let nextOffset: number | undefined;
    for await (const batch of this.#scanCollection(cls, () => this.#buildIndexQuery(cls, idx, body), {
      limit: 100,
      ...options,
      offset: options?.offset ? JSONUtil.fromBase64<number>(options.offset) : 0
    })) {
      items.push(...batch.items);
      nextOffset = batch.nextOffset;
    }

    return { items, nextOffset: nextOffset ? JSONUtil.toBase64(nextOffset) : undefined };
  }

  async * listByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    for await (const { items } of this.#scanCollection(cls, () => this.#buildIndexQuery(cls, idx, body), options)) {
      yield items;
    }
  }

  async suggestByIndex<T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, prefix: string, options?: ModelIndexedSearchOptions): Promise<T[]> {
    const results: T[] = [];

    const field = idx.sortTemplate[0].path.join('.');

    for await (const { items } of this.#scanCollection(cls,
      () => this.#buildIndexQuery(cls, idx, body)
        .where(field, '>=', prefix)
        .where(field, '<', `${prefix}\uf8ff`),
      { limit: 10, ...options })
    ) {
      results.push(...items);
    }

    return results;
  }
}