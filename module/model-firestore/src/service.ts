import * as firebase from 'firebase-admin';

import { ResourceManager, ShutdownManager, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { ChangeEvent, Class } from '@travetto/registry';
import {
  ModelCrudSupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError
} from '@travetto/model-core';

import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model-core/src/internal/service/indexed';

import { FirestoreModelConfig } from './config';

const toSimple = (inp: any, missingValue: any = null): any => {
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
    return Object.fromEntries(Object.entries(inp)
      .filter(([k, v]) => !Util.isFunction(v))
      .map(([k, v]) => [k, toSimple(v, missingValue)]));
  }
};

/**
 * A model service backed by Firestore
 */
@Injectable()
export class FirestoreModelService implements ModelCrudSupport, ModelStorageSupport, ModelIndexedSupport {

  cl: firebase.firestore.Firestore;

  constructor(private config: FirestoreModelConfig) { }

  private resolveTable(cls: Class) {
    let table = ModelRegistry.getStore(cls);
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  private getCollection(cls: Class) {
    return this.cl.collection(this.resolveTable(cls));
  }

  async postConstruct() {
    firebase.initializeApp({
      ...(this.config.credential ? { credential: firebase.credential.cert(await ResourceManager.toAbsolutePath(this.config.credential)) } : undefined),
      projectId: this.config.projectId,
      databaseURL: this.config.databaseURL
    });
    this.cl = firebase.firestore();
    ShutdownManager.onShutdown(__filename, () => this.cl.terminate());
  }

  // Storage

  /**
   * An event listener for whenever a model is added, changed or removed
   */
  async onModelVisibilityChange?<T extends ModelType>(e: ChangeEvent<Class<T>>) {
    const cls = (e.curr || e.prev)!;
    // Don't create tables for non-concrete types
    if (ModelRegistry.getBaseModel(cls) !== cls) {
      return;
    }

    switch (e.type) {
      case 'added': break;
      case 'changed': break;
      case 'removing': {
        for await (const el of this.list(cls)) {
          await this.delete(cls, el.id!);
        }
      }
    }
  }

  async createStorage() {
    // Do nothing
  }

  async deleteStorage() {

  }

  // Crud
  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.getCollection(cls).doc(id).get();

    if (res && res.exists) {
      return await ModelCrudUtil.load(cls, res.data()!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.getCollection(cls).doc(item.id!).create(toSimple(item));
    return item;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.getCollection(cls).doc(item.id!).update(toSimple(item));
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.getCollection(cls).doc(item.id!).set(toSimple(item));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, async () => ({} as unknown as T));
    await this.getCollection(cls).doc(id!).set(toSimple(item, firebase.firestore.FieldValue.delete()), { merge: true });
    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    await this.getCollection(cls).doc(id).delete();
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    const batch = await this.getCollection(cls).select().get();
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
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res = ModelIndexedUtil.flattenIndexItem(cls, idx, body);
    const query = res.reduce((q, [k, v]) =>
      q.where(k, '==', v), this.getCollection(cls) as firebase.firestore.Query);

    const item = await query.get();

    if (item && !item.empty) {
      return this.get(cls, item.docs[0].id!);
    }

    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; '));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res = ModelIndexedUtil.flattenIndexItem(cls, idx, body);
    const query = res.reduce((q, [k, v]) =>
      q.where(k, '==', v), this.getCollection(cls) as firebase.firestore.Query);

    const item = await query.get();

    if (item && !item.empty) {
      return this.delete(cls, item.docs[0].id!);
    }

    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; '));
  }
}