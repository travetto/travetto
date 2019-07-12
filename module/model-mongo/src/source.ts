import * as mongo from 'mongodb';

import {
  ModelSource, IndexConfig, Query,
  BulkResponse,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  BulkOp,
  ModelQuery,
  ValidStringFields,
  WhereClauseRaw
} from '@travetto/model';

import { Class } from '@travetto/registry';
import { AppError } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { MongoUtil } from './util';
import { MongoModelConfig } from './config';

@Injectable()
export class MongoModelSource extends ModelSource {

  private client: mongo.MongoClient;
  private db: mongo.Db;
  private indices: Record<string, IndexConfig<any>[]> = {};

  constructor(private config: MongoModelConfig) {
    super();
  }

  generateId() {
    return new mongo.ObjectId().toHexString();
  }

  async suggestField<T extends ModelCore, U = T>(
    cls: Class<T>, field: ValidStringFields<T>, query: string, filter?: PageableModelQuery<T>
  ): Promise<U[]> {
    if (!filter) {
      filter = {};
    }
    filter.limit = filter.limit || 10;
    const suggestQuery = {
      [field]: new RegExp(`\\b${query}`, 'i')
    } as any as WhereClauseRaw<T>;

    if (!filter.where) {
      filter.where = suggestQuery;
    } else {
      filter.where = {
        $and: [
          filter.where,
          suggestQuery
        ]
      } as WhereClauseRaw<T>;
    }
    return this.query(cls, filter);
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const col = await this.getCollection(cls);

    const projected = MongoUtil.extractTypedWhereClause(cls, query.where || {});

    let cursor = col.find(projected);
    if (query.select) {
      cursor.project(Object.keys(query.select)[0].startsWith('$') ? query.select : MongoUtil.extractSimple(query.select));
    }

    if (query.sort) {
      cursor = cursor.sort(query.sort.map(x => MongoUtil.extractSimple(x)));
    }

    cursor = cursor.limit(Math.trunc(query.limit || 200) || 200);

    if (query.offset) {
      cursor = cursor.skip(Math.trunc(query.offset) || 0);
    }
    const res = await cursor.toArray() as any as U[];
    return res;
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    if ((o as any)._id) {
      o.id = ((o as any)._id as any as mongo.ObjectId).toHexString();
      delete (o as any)._id;
    }
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    return o;
  }

  cleanseId<T extends ModelCore>(o: T): mongo.ObjectId {
    if (o.id) {
      (o as any)._id = new mongo.ObjectId(o.id);
      delete o.id;
    }
    return (o as any)._id;
  }

  async postConstruct() {
    await this.init();
  }

  async init() {
    this.client = await mongo.MongoClient.connect(this.config.url);
    this.db = this.client.db();
    await this.establishIndices();
  }

  async establishIndices() {
    const promises = [];

    for (const colName of Object.keys(this.indices)) {
      const col = await this.db.collection(colName);

      for (const { fields, options } of this.indices[colName]) {
        promises.push(col.createIndex(fields, options));
      }
    }
    return Promise.all(promises);
  }

  getCollectionName<T extends ModelCore>(cls: Class<T>): string {
    cls = ModelRegistry.getBaseModel(cls);
    return ModelRegistry.getCollectionName(cls);
  }

  async getCollection<T extends ModelCore>(cls: Class<T>): Promise<mongo.Collection> {
    return this.db.collection(this.getCollectionName(cls));
  }

  async resetDatabase() {
    await this.db.dropDatabase();
    await this.init();
  }

  registerIndex(cls: Class, fields: Record<string, number>, options: mongo.IndexOptions) {
    const col = this.getCollectionName(cls);
    this.indices[col] = this.indices[col] || [];

    // TODO: Cleanup
    this.indices[col].push({ fields, options } as any);
  }

  getIndices(cls: Class) {
    return this.indices[this.getCollectionName(cls)];
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    const res = await this.query(cls, query);
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const col = await this.getCollection(cls);
    const cursor = col.count(MongoUtil.extractTypedWhereClause(cls, query.where || {}));

    const res = await cursor;
    return res;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 200, ...query });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new AppError(`Invalid number of results for find by id: ${res ? res.length : res}`, 'notfound');
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    const query = { where: { id } } as any as ModelQuery<T>;
    return await this.getByQuery(cls, query);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const col = await this.getCollection(cls);
    const conf = ModelRegistry.get(cls);
    const res = await col.deleteOne({ _id: new mongo.ObjectId(id), ...(conf.subType ? { type: conf.subType } : {}) });

    return res.deletedCount || 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const col = await this.getCollection(cls);
    const res = await col.deleteMany(MongoUtil.extractTypedWhereClause(cls, query.where || {}));
    return res.deletedCount || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId: boolean = false): Promise<T> {
    const col = await this.getCollection(cls);
    if (!keepId) {
      delete o.id;
    }
    this.cleanseId(o);
    const res = await col.insertOne(o);
    o.id = res.insertedId.toHexString();
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[], keepId: boolean = false): Promise<T[]> {
    const col = await this.getCollection(cls);
    for (const x of objs) {
      if (!keepId) {
        delete x.id;
      }
      this.cleanseId(x);
    }
    const res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i].id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    o = this.prePersist(cls, o);
    const id = this.cleanseId(o);
    const col = await this.getCollection(cls);
    const conf = ModelRegistry.get(cls);
    const res = await col.replaceOne({ _id: id, ...(conf.subType ? { type: conf.subType } : {}) }, o);
    if (res.matchedCount === 0) {
      throw new AppError(`Invalid update, no ${cls.name} found with id '${id}'`, 'notfound');
    }
    return this.getById(cls, id.toHexString());
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T>): Promise<T> {
    return await this.updatePartialByQuery(cls, { where: { id: data.id } } as any as ModelQuery<T>, data);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    const col = await this.getCollection(cls);

    let final: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      const items = MongoUtil.extractSimple(final);
      final = Object.entries(items).reduce((acc, [k, v]) => {
        if (v === null || v === undefined) {
          acc.$unset = acc.$unset || {};
          acc.$unset[k] = v;
        } else {
          acc.$set = acc.$set || {};
          acc.$set[k] = v;
        }
        return acc;
      }, {} as any);
    }

    const res = await col.findOneAndUpdate(MongoUtil.extractTypedWhereClause(cls, query.where || {}), final, { returnOriginal: false });
    if (!res.value) {
      throw new AppError('Object not found for updating', 'notfound');
    }

    const ret: T = res.value as T;
    return ret;
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, data: Partial<T>) {
    const col = await this.getCollection(cls);

    const res = await col.updateMany(MongoUtil.extractTypedWhereClause(cls, query.where || {}), data);
    return res.matchedCount;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]) {
    const col = await this.getCollection(cls);
    const bulk = col.initializeUnorderedBulkOp({});
    const out: BulkResponse = {
      errors: [],
      counts: {
        delete: 0,
        update: 0,
        upsert: 0,
        insert: 0,
        error: 0
      },
      insertedIds: new Map()
    };

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.insert) {
        op.insert.id = new mongo.ObjectId().toHexString();
        out.insertedIds.set(i, op.insert.id!);

        bulk.insert(op.insert);
      } else if (op.upsert) {
        if (!op.upsert.id) {
          op.upsert.id = new mongo.ObjectId().toHexString();
          out.insertedIds.set(i, op.upsert.id!);
        }

        bulk.find({ _id: op.upsert.id ? new mongo.ObjectId(op.upsert.id) : undefined })
          .upsert()
          .updateOne({ $set: op.upsert });
      } else if (op.update) {
        bulk.find({ _id: new mongo.ObjectId(op.update.id) }).update({ $set: op.update });
      } else if (op.delete) {
        bulk.find({ _id: new mongo.ObjectId(op.delete.id) }).removeOne();
      }
    }

    if (operations.length > 0) {
      const res = await bulk.execute({});

      if (out.counts) {
        out.counts.delete = res.nRemoved;
        out.counts.update = (res.nModified || 0) + (res.nUpdated || 0);
        out.counts.insert = res.nInserted;
        out.counts.upsert = res.nUpserted;
      }

      if (res.hasWriteErrors()) {
        out.errors = res.getWriteErrors();
        out.counts.error = out.errors.length;
      }
    }

    return out;
  }
}