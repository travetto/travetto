import { DocumentData, FieldValue, Firestore, PartialWithFieldValue, Query, UpdateData } from '@google-cloud/firestore';

import { ShutdownManager, Util, Class } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import {
  ModelCrudSupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, OptionalId
} from '@travetto/model';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';

import { FirestoreModelConfig } from './config';

const clone = <T>(inp: T): T => JSON.parse(JSON.stringify(inp));

const toSimpleObj = <T>(inp: T, missingValue: unknown = null): PartialWithFieldValue<DocumentData> =>
  JSON.parse(JSON.stringify(inp, (_, v) => v ?? null), (_, v) => v ?? missingValue);

/**
 * A model service backed by Firestore
 */
@Injectable()
export class FirestoreModelService implements ModelCrudSupport, ModelStorageSupport, ModelIndexedSupport {

  client: Firestore;

  constructor(public readonly config: FirestoreModelConfig) { }

  #resolveTable(cls: Class): string {
    let table = ModelRegistry.getStore(cls);
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
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.terminate());
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
  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const res = await this.#getCollection(cls).doc(id).get();

    if (res && res.exists) {
      return await ModelCrudUtil.load(cls, res.data()!);
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await this.#getCollection(cls).doc(item.id).update(clone(prepped) as unknown as UpdateData<DocumentData>);
    return item;
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, async () => ({} as unknown as T));
    const cleaned = toSimpleObj(item, FieldValue.delete());
    await this.#getCollection(cls).doc(id).set(cleaned, { merge: true });
    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);
    try {
      await this.#getCollection(cls).doc(id).delete({ exists: true });
    } catch (err) {
      if (err && err instanceof Error && err.message.includes('NOT_FOUND')) {
        throw new NotFoundError(cls, id);
      }
      throw err;
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    const batch = await this.#getCollection(cls).select().get();
    for (const el of batch.docs) {
      try {
        yield await this.get(cls, el.id);
      } catch (err) {
        if (!(err instanceof NotFoundError)) {
          throw err;
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

    const { fields, sorted } = ModelIndexedUtil.computeIndexParts(cls, idx, body, { emptySortValue: null });
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