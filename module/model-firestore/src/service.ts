import { type DocumentData, FieldValue, Firestore, type Query } from '@google-cloud/firestore';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  type BulkResponse,
  type BulkSource,
  type ModelBulkSupport,
  ModelBulkUtil,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  ModelStorageUtil,
  type ModelType,
  ExistsError,
  NotFoundError,
  type OptionalId,
  type PartialWithId
} from '@travetto/model';
import {
  type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody,
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
import { type Class, castTo, JSONUtil, RuntimeError, ShutdownManager } from '@travetto/runtime';

import type { FirestoreModelConfig } from './config.ts';

const clone = JSONUtil.clone;
const setMissingValues = <T>(input: T, missingValue: unknown): T =>
  JSONUtil.clone(input, { replacer: (_, value) => value ?? null, reviver: (_, value) => value ?? missingValue });

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error.message.includes('NOT_FOUND') || (error as { code?: number }).code === 5);
}

function isExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('ALREADY_EXISTS') || error.message.includes('already exists') || (error as { code?: number }).code === 6)
  );
}

/**
 * A model service backed by Firestore
 */
@Injectable()
export class FirestoreModelService implements ModelCrudSupport, ModelBulkSupport, ModelStorageSupport, ModelIndexedSupport {
  static resolveTable(cls: Class, namespace?: string): string {
    let table = ModelRegistryIndex.getStoreName(cls);
    if (namespace) {
      table = `${namespace}_${table}`;
    }
    return table;
  }

  client: Firestore;
  config: FirestoreModelConfig;

  constructor(config: FirestoreModelConfig) {
    this.config = config;
  }

  #resolveTable(cls: Class): string {
    return FirestoreModelService.resolveTable(cls, this.config.namespace);
  }

  #getCollection(cls: Class): FirebaseFirestore.CollectionReference<DocumentData> {
    return this.client.collection(this.#resolveTable(cls));
  }

  async #getIdByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<string> {
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
    if (item.size > 1) {
      throw new RuntimeError(`Multiple items found for ${cls.name} Index=${idx}`);
    }
    return item.docs[0].id;
  }

  #buildIndexQuery<T extends ModelType>(cls: Class<T>, idx: SortedIndex<T>, body: KeyedIndexBody<T>): Query {
    ModelCrudUtil.ensureNotSubType(cls);
    const computed = ModelIndexedComputedIndex.get(idx, body).validate();

    let query = computed.keyedParts.reduce<Query>(
      (result, { path, value, state }) => result.where(path.join('.'), '==', state === 'empty' ? null : value),
      this.#getCollection(cls)
    );

    for (const { path, value } of idx.sortTemplate) {
      query = query.orderBy(path.join('.'), value === 1 ? 'asc' : 'desc');
    }
    return query;
  }

  async *#scanCollection<T extends ModelType>(
    cls: Class<T>,
    queryBuilder: () => Query,
    options?: ModelListOptions & ModelPageOptions<number>
  ): AsyncIterable<{ items: T[]; nextOffset?: number }> {
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const query = queryBuilder().limit(batchSize).offset(offset);

      const { docs, size } = await query.get();
      if (size === 0) {
        break;
      }

      const remaining = produced + size > limit ? docs.slice(0, limit - produced) : docs;

      offset += size;

      const items = await ModelCrudUtil.filterOutNotFound(remaining.map(item => ModelCrudUtil.load(cls, item.data()!)));
      produced += items.length;

      yield { items, nextOffset: offset };
    }
  }

  @PostConstruct()
  async initializeClient(): Promise<void> {
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
  async deleteStorage(): Promise<void> {}

  async truncateModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    await this.client.recursiveDelete(this.#getCollection(cls));
  }

  async deleteModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    await ModelStorageUtil.runAndIgnoreNotFound(() => this.truncateModel(cls), isNotFoundError);
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const result = await this.#getCollection(cls).doc(id).get();

    if (result?.exists) {
      return await ModelCrudUtil.load(cls, result.data()!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preCreate(cls, item);
    const id = ModelRegistryIndex.get(cls).idSource.get(prepped);
    try {
      await this.#getCollection(cls).doc(id).create(clone<DocumentData>(prepped));
    } catch (error) {
      if (isExistsError(error)) {
        throw new ExistsError(cls, id);
      }
      throw error;
    }
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    const prepped = await ModelCrudUtil.preUpdate(cls, item, {
      ensureNotSubType: true,
      getOperation: id => this.get(cls, id),
      readBeforeUpdate: this.config.readBeforeUpdate
    });
    const id = ModelRegistryIndex.get(cls).idSource.get(prepped);
    await this.#getCollection(cls).doc(id).set(clone<DocumentData>(prepped), { merge: false });
    return prepped;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preUpsert(cls, item, { ensureNotSubType: true });
    const id = ModelRegistryIndex.get(cls).idSource.get(prepped);
    await this.#getCollection(cls).doc(id).set(clone<DocumentData>(prepped));
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: PartialWithId<T>): Promise<T> {
    const id = ModelRegistryIndex.get(cls).idSource.get(item);
    const prepared = await ModelCrudUtil.prePartialUpdate(cls, item, {
      ensureNotSubType: true
    });
    const full = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), prepared);
    const cleaned = setMissingValues(full, FieldValue.delete());
    await this.#getCollection(cls)
      .doc(id)
      .set(cleaned, { mergeFields: Object.keys(full) });
    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    id = await ModelCrudUtil.preDelete(cls, id, { ensureNotSubType: true });
    try {
      await this.#getCollection(cls).doc(id).delete({ exists: true });
    } catch (error) {
      if (error && error instanceof Error && error.message.includes('NOT_FOUND')) {
        throw new NotFoundError(cls, id);
      }
      throw error;
    }
  }

  async *list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const { items } of this.#scanCollection(cls, () => this.#getCollection(cls), options)) {
      yield items;
    }
  }

  // Bulk support
  mutateBulk<T extends ModelType>(cls: Class<T>, operations: BulkSource<T>, batchSize = 500): AsyncIterable<BulkResponse> {
    return ModelBulkUtil.stream(cls, operations, batchSize, async ({ operations: resolvedOperations }) => {
      const idSource = ModelRegistryIndex.get(cls).idSource;
      const collection = this.#getCollection(cls);

      const counts = {
        update: 0,
        insert: 0,
        upsert: 0,
        delete: 0,
        error: 0
      };
      const errors: unknown[] = [];
      const insertedIds = new Map<number, string>();

      // Verify entity existence beforehand where needed
      const docRefs = resolvedOperations.map(operation => {
        const entity = operation.insert ?? operation.update ?? operation.upsert ?? operation.delete;
        return entity ? collection.doc(idSource.get(entity)) : null;
      });

      const snapshots = await this.client.getAll(...docRefs.filter((ref): ref is NonNullable<typeof ref> => ref !== null));
      const snapshotMap = new Map<string, boolean>();
      for (const snapshot of snapshots) {
        snapshotMap.set(snapshot.id, snapshot.exists);
      }

      const batch = this.client.batch();
      const queuedOperations: { property: 'insert' | 'update' | 'upsert' | 'delete'; index: number; id?: string }[] = [];

      for (let index = 0; index < resolvedOperations.length; index += 1) {
        const operation = resolvedOperations[index];
        const docRef = docRefs[index];
        if (!docRef) {
          continue;
        }
        const existsInDb = snapshotMap.get(docRef.id) ?? false;

        try {
          if ('insert' in operation && operation.insert) {
            if (existsInDb) {
              throw new ExistsError(cls, docRef.id);
            }
            batch.create(docRef, clone<DocumentData>(operation.insert));
            queuedOperations.push({ property: 'insert', index, id: docRef.id });
          } else if ('update' in operation && operation.update) {
            if (!existsInDb) {
              throw new NotFoundError(cls, docRef.id);
            }
            batch.set(docRef, clone<DocumentData>(operation.update), { merge: false });
            queuedOperations.push({ property: 'update', index });
          } else if ('upsert' in operation && operation.upsert) {
            batch.set(docRef, clone<DocumentData>(operation.upsert));
            queuedOperations.push({ property: 'upsert', index, id: !existsInDb ? docRef.id : undefined });
          } else if ('delete' in operation && operation.delete) {
            if (!existsInDb) {
              throw new NotFoundError(cls, docRef.id);
            }
            batch.delete(docRef);
            queuedOperations.push({ property: 'delete', index });
          }
        } catch (error) {
          counts.error += 1;
          errors.push(typeof error === 'object' && error !== null ? Object.assign(error, { index }) : { index, error });
        }
      }

      if (queuedOperations.length > 0) {
        try {
          await batch.commit();
          for (const item of queuedOperations) {
            counts[item.property] += 1;
            if (item.id) {
              insertedIds.set(item.index, item.id);
            }
          }
        } catch (error) {
          counts.error += queuedOperations.length;
          errors.push(error);
        }
      }

      return { counts, errors, insertedIds };
    });
  }

  // Indexed contract

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

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    for await (const { items } of this.#scanCollection(cls, () => this.#buildIndexQuery(cls, idx, body), options)) {
      yield items;
    }
  }

  async suggestByIndex<T extends ModelType, S extends SortedIndexSelection<T>, K extends KeyedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    prefix: string,
    options?: ModelIndexedSearchOptions
  ): Promise<T[]> {
    const results: T[] = [];

    const field = idx.sortTemplate[0].path.join('.');

    for await (const { items } of this.#scanCollection(
      cls,
      () => this.#buildIndexQuery(cls, idx, body).where(field, '>=', prefix).where(field, '<', `${prefix}\uf8ff`),
      { limit: 10, ...options }
    )) {
      results.push(...items);
    }

    return results;
  }
}
