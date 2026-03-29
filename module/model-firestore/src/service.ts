import { type DocumentData, FieldValue, Firestore, type Query } from '@google-cloud/firestore';

import { castTo, JSONUtil, ShutdownManager, type Any, type Class } from '@travetto/runtime';
import { Injectable, PostConstruct } from '@travetto/di';
import {
  type ModelCrudSupport, ModelRegistryIndex, type ModelStorageSupport,
  type ModelIndexedSupport, type ModelType, NotFoundError, type OptionalId,
  ModelCrudUtil, ModelIndexedUtil, type ListPageOptions, type ListPageResult,
  type KeyedIndex,
  type KeyedIndexBody,
  type KeyedIndexSelection,
  type KeyedIndexWithPartialBody,
  type SingleItemIndex,
  type SortedIndex,
  type SortedIndexSelection,
  type SortedKeyedIndex,
  type MultipleItemIndex,
} from '@travetto/model';

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

  #buildIndexQuery<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: MultipleItemIndex<T, K>, body: KeyedIndexBody<T, K>): Query {
    ModelCrudUtil.ensureNotSubType(cls);
    const { fields, sorted } = ModelIndexedUtil.computeIndexParts(cls, idx, castTo(body), { emptySortValue: null });
    let query = fields.reduce<Query>((result, { path, value }) =>
      result.where(path.join('.'), '==', value), this.#getCollection(cls));

    if (sorted) {
      query = query.orderBy(sorted.path.join('.'), sorted.dir === 1 ? 'asc' : 'desc');
    }
    return query;
  }

  @PostConstruct()
  async initializeClient(): Promise<void> {
    globalThis.devProcessWarningExclusions?.push((_, category) => category === 'MetadataLookupWarning');
    this.client = new Firestore({ ...this.config, useBigInt: true });
    ShutdownManager.signal.addEventListener('abort', () => this.client.terminate());
  }

  // Storage
  async createStorage(): Promise<void> { }
  async deleteStorage(): Promise<void> { }

  async deleteModel(cls: Class): Promise<void> {
    for await (const item of this.list(cls)) {
      await this.delete(cls, item.id);
    }
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

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    const batch = await this.#getCollection(cls).select().get();
    for (const item of batch.docs) {
      try {
        yield await this.get(cls, item.id);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
  }

  // Indexed
  async #getIdByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const { fields } = ModelIndexedUtil.computeIndexParts(cls, idx, castTo(body));
    const query = fields.reduce<Query>(
      (result, { path, value }) => result.where(path.join('.'), '==', value),
      this.#getCollection(cls)
    );

    const item = await query.get();

    if (item && !item.empty) {
      return item.docs[0].id;
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, castTo(body), { separator: '; ' })?.key);
  }

  // Indexed contract

  async getByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: SingleItemIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
  >(cls: Class<T>, idx: SingleItemIndex<T, K>, body: KeyedIndexBody<T, K>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  updateByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K>, body: T): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K>, body: KeyedIndexWithPartialBody<T, K>): Promise<T> {
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
    const offset = options.offset ? JSONUtil.fromBase64<number>(options.offset) : 0;
    const limit = options.limit;
    const query = this.#buildIndexQuery(cls, idx, options.body)
      .limit(limit)
      .offset(offset);

    const items: T[] = [];
    for (const item of (await query.get()).docs) {
      items.push(await ModelCrudUtil.load(cls, item.data()!));
    }

    return { items, nextOffset: items.length ? JSONUtil.toBase64(offset + items.length) : undefined };
  }
}