import { type DocumentData, FieldValue, Firestore, type Query } from '@google-cloud/firestore';

import { castTo, JSONUtil, ShutdownManager, type Class } from '@travetto/runtime';
import { Injectable, PostConstruct } from '@travetto/di';
import {
  type ModelCrudSupport, ModelRegistryIndex, type ModelStorageSupport, type ModelType, NotFoundError, type OptionalId, ModelCrudUtil,
} from '@travetto/model';
import {
  type ModelIndexedSupport, type KeyedIndexSelection, type KeyedIndexBody, type ListPageOptions, ModelIndexedUtil,
  type SingleItemIndex, type SortedIndexSelection, type ListPageResult, type SortedIndex, type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody, ModelIndexedComputedIndex
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

  async listByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ListPageOptions,
  ): Promise<ListPageResult<T>> {
    const offset = options?.offset ? JSONUtil.fromBase64<number>(options.offset) : 0;
    const limit = options?.limit ?? 100;
    const query = this.#buildIndexQuery(cls, idx, body)
      .limit(limit)
      .offset(offset);

    const items: T[] = [];
    for (const item of (await query.get()).docs) {
      items.push(await ModelCrudUtil.load(cls, item.data()!));
    }

    return { items, nextOffset: items.length ? JSONUtil.toBase64(offset + items.length) : undefined };
  }
}