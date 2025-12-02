import { DocumentData, FieldValue, Firestore, PartialWithFieldValue, Query } from '@google-cloud/firestore';

import { ShutdownManager, type Class, type DeepPartial } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import {
  ModelCrudSupport, ModelRegistryIndex, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, OptionalId,
  ModelCrudUtil, ModelIndexedUtil,
} from '@travetto/model';

import { FirestoreModelConfig } from './config.ts';

const clone = structuredClone;

const toSimpleObj = <T>(inp: T, missingValue: unknown = null): PartialWithFieldValue<DocumentData> =>
  JSON.parse(JSON.stringify(inp, (_, v) => v ?? null), (_, v) => v ?? missingValue);

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

  async postConstruct(): Promise<void> {
    this.client = new Firestore(this.config);
    ShutdownManager.onGracefulShutdown(() => this.client.terminate());
  }

  // Storage
  async createStorage(): Promise<void> { }
  async deleteStorage(): Promise<void> { }

  async deleteModel(cls: Class): Promise<void> {
    for await (const el of this.list(cls)) {
      await this.delete(cls, el.id);
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
    await this.#getCollection(cls).doc(prepped.id).create(clone(prepped));
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(item.id).update(clone<DocumentData>(prepped));
    return prepped;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(prepped.id).set(clone(prepped));
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    const full = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    const cleaned = toSimpleObj(full, FieldValue.delete());
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
    for (const el of batch.docs) {
      try {
        yield await this.get(cls, el.id);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
  }

  // Indexed
  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const { fields } = ModelIndexedUtil.computeIndexParts(cls, idx, body);
    const query = fields.reduce<Query>(
      (q, { path, value }) => q.where(path.join('.'), '==', value),
      this.#getCollection(cls)
    );

    const item = await query.get();

    if (item && !item.empty) {
      return item.docs[0].id;
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, { sep: '; ' })?.key);
  }

  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): AsyncIterable<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const cfg = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { fields, sorted } = ModelIndexedUtil.computeIndexParts(cls, cfg, body, { emptySortValue: null });
    let query = fields.reduce<Query>((q, { path, value }) =>
      q.where(path.join('.'), '==', value), this.#getCollection(cls));

    if (sorted) {
      query = query.orderBy(sorted.path.join('.'), sorted.dir === 1 ? 'asc' : 'desc');
    }

    for (const el of (await query.get()).docs) {
      yield await ModelCrudUtil.load(cls, el.data()!);
    }
  }
}