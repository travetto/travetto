import * as firebase from 'firebase-admin';

import { ResourceManager, ShutdownManager, Util, Class } from '@travetto/base';
import { Injectable } from '@travetto/di';
import {
  ModelCrudSupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, SubTypeNotSupportedError
} from '@travetto/model';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';

import { FirestoreModelConfig } from './config';

const toSimple = (inp: unknown, missingValue: unknown = null): unknown => {
  if (inp === undefined || inp === null) {
    return missingValue;
  } else if (Array.isArray(inp)) {
    return inp.map(v => toSimple(v, missingValue));
  } else if (inp instanceof Set) {
    return [...inp].map(v => toSimple(v, missingValue));
  } else if (Util.isPrimitive(inp)) {
    return inp;
  } else if (inp instanceof Map) {
    return Object.fromEntries([...inp.entries()].map(([k, v]) => [k, toSimple(v, missingValue)]));
  } else {
    return Object.fromEntries(Object.entries(inp as object)
      .filter(([k, v]) => !Util.isFunction(v))
      .map(([k, v]) => [k, toSimple(v, missingValue)]));
  }
};

const toSimpleObj = <T>(inp: T, missingValue: unknown = null) =>
  toSimple(inp, missingValue) as Record<string, unknown>;

/**
 * A model service backed by Firestore
 */
@Injectable()
export class FirestoreModelService implements ModelCrudSupport, ModelStorageSupport, ModelIndexedSupport {

  static app: firebase.app.App;

  client: firebase.firestore.Firestore;

  constructor(public readonly config: FirestoreModelConfig) { }

  #resolveTable(cls: Class) {
    let table = ModelRegistry.getStore(cls);
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  #getCollection(cls: Class) {
    return this.client.collection(this.#resolveTable(cls));
  }

  async postConstruct() {
    if (!FirestoreModelService.app) {
      FirestoreModelService.app = firebase.initializeApp({
        ...(this.config.credential ? { credential: firebase.credential.cert(await ResourceManager.findAbsolute(this.config.credential)) } : undefined),
        projectId: this.config.projectId,
        databaseURL: this.config.databaseURL
      });
    }
    this.client = FirestoreModelService.app.firestore();
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.terminate());
  }

  // Storage
  async createStorage() { }
  async deleteStorage() { }

  async deleteModel(cls: Class) {
    for await (const el of this.list(cls)) {
      await this.delete(cls, el.id);
    }
  }

  // Crud
  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.#getCollection(cls).doc(id).get();

    if (res && res.exists) {
      return await ModelCrudUtil.load(cls, res.data()!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(item.id).create(toSimpleObj(item));
    return item;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(item.id).update(toSimpleObj(item));
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.#getCollection(cls).doc(item.id).set(toSimpleObj(item));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, async () => ({} as unknown as T));
    await this.#getCollection(cls).doc(id).set(toSimpleObj(item, firebase.firestore.FieldValue.delete()), { merge: true });
    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    try {
      await this.#getCollection(cls).doc(id).delete({ exists: true } as unknown as firebase.firestore.Precondition);
    } catch (err) {
      if (`${err.message}`.includes('NOT_FOUND')) {
        throw new NotFoundError(cls, id);
      }
      throw err;
    }
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    const batch = await this.#getCollection(cls).select().get();
    for (const el of batch.docs) {
      try {
        yield await this.get(cls, el.id);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }
    }
  }

  // Indexed
  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    const res = ModelIndexedUtil.flattenIndexItem(cls, idx, body);
    const query = res.reduce((q, [k, v]) =>
      q.where(k, '==', v), this.#getCollection(cls) as firebase.firestore.Query);

    const item = await query.get();

    if (item && !item.empty) {
      return item.docs[0].id;
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; ').key);
  }

  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    throw new Error('Listing by index is not currently supported for firestore');
  }
}