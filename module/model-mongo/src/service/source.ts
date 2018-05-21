import * as mongo from 'mongodb';

import {
  ModelSource, IndexConfig, Query,
  QueryOptions, BulkState, BulkResponse,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  WhereClause,
  SelectClause,
  SortClause,
  ModelQuery
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { ModelMongoConfig } from './config';
import { Class } from '@travetto/registry';
import { BaseError, isPlainObject } from '@travetto/base';

const has$And = (o: any): o is ({ $and: WhereClause<any>[]; }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[]; }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any>; }) => '$not' in o;
const hasId = <T>(o: T): o is (T & { id: string | string[] | { $in: string[] } }) => 'id' in o;
const has$In = (o: any): o is { $in: any[] } => '$in' in o && Array.isArray(o.$in);

export function extractWhereClause<T>(o: WhereClause<T>): { [key: string]: any } {
  if (has$And(o)) {
    return { $and: o.$and.map(x => extractWhereClause<T>(x)) };
  } else if (has$Or(o)) {
    return { $or: o.$or.map(x => extractWhereClause<T>(x)) };
  } else if (has$Not(o)) {
    return { $nor: [extractWhereClause<T>(o.$not)] };
  } else {
    return extractSimple(o);
  }
}

export function extractSimple<T>(o: T, path: string = ''): { [key: string]: any } {
  const out: { [key: string]: any } = {};
  const sub = o as { [key: string]: any };
  const keys = Object.keys(sub);
  for (const key of keys) {
    const subpath = `${path}${key}`;
    if (isPlainObject(sub[key]) && !Object.keys(sub[key])[0].startsWith('$')) {
      Object.assign(out, extractSimple(sub[key], `${subpath}.`));
    } else {
      out[subpath] = sub[key];
    }
  }
  return out;
}

export class ModelMongoSource extends ModelSource {

  private client: mongo.MongoClient;
  private db: mongo.Db;
  private indices: { [key: string]: IndexConfig<any>[] } = {};

  constructor(private config: ModelMongoConfig) {
    super();
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const col = await this.getCollection(cls);

    const projected = extractWhereClause(query.where || {});

    let cursor = col.find(projected);
    if (query.select) {
      cursor.project(Object.keys(query.select)[0].startsWith('$') ? query.select : extractSimple(query.select));
    }

    if (query.sort) {
      cursor = cursor.sort(query.sort.map(x => extractSimple(x)));
    }

    cursor = cursor.limit(Math.trunc(query.limit || 200) || 200);

    if (query.offset) {
      cursor = cursor.skip(Math.trunc(query.offset) || 0);
    }
    const res = await cursor.toArray() as any as U[];
    for (const r of res) {
      this.postLoad(undefined as any, r as any);
    }
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
    if (o.id) {
      (o as any)._id = new mongo.ObjectId(o.id) as any;
      delete o.id;
    }
    return o;
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

  translateQueryIds<T extends ModelCore, U extends Query<T>>(query: U) {
    const where = (query.where || {});
    if (hasId(where)) {
      const val = where.id;
      if (Array.isArray(val) || typeof val === 'string') {
        let res: (mongo.ObjectID | mongo.ObjectID[]);
        if (typeof val === 'string') {
          res = new mongo.ObjectID(val);
        } else {
          res = val.map(x => typeof x === 'string' ? new mongo.ObjectID(x) : x);
        }
        delete where.id;
        (where as any)._id = res;
      } else if (has$In(val)) {
        const res: { $in: (string | mongo.ObjectID)[] } = val;
        (where as any)._id = { $in: res.$in.map(x => typeof x === 'string' ? new mongo.ObjectID(x) : x) };
      }
    }
    return query;
  }

  getCollectionName<T extends ModelCore>(cls: Class<T>): string {
    return ModelRegistry.get(cls).collection || cls.name;
  }

  async getCollection<T extends ModelCore>(cls: Class<T>): Promise<mongo.Collection> {
    return this.db.collection(this.getCollectionName(cls));
  }

  async resetDatabase() {
    await this.db.dropDatabase();
    await this.init();
  }

  registerIndex(cls: Class, fields: { [key: string]: number }, options: mongo.IndexOptions) {
    const col = this.getCollectionName(cls);
    this.indices[col] = this.indices[col] || [];

    // TODO: Cleanup
    this.indices[col].push({ fields, options } as any);
  }

  getIndices(cls: Class) {
    return this.indices[this.getCollectionName(cls)];
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>) {
    const col = await this.getCollection(cls);
    const objs = await col.find(query as mongo.FilterQuery<T>, { fields: { _id: 1 } } as any).toArray() as T[];
    return objs.map(x => this.postLoad(cls, x));
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    query = this.translateQueryIds(query);
    const res = await this.query(cls, query);
    res.forEach(r => this.postLoad(cls, r));
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    query = this.translateQueryIds(query);

    const col = await this.getCollection(cls);
    const cursor = col.count(query.where || {});

    const res = await cursor;
    return res;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 200, ...query });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new BaseError(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    return await this.getByQuery(cls, { _id: id } as any);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const col = await this.getCollection(cls);
    const res = await col.deleteOne({ _id: new mongo.ObjectID(id) });

    return res.deletedCount || 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    query = this.translateQueryIds(query);
    const col = await this.getCollection(cls);
    const res = await col.deleteMany(extractWhereClause(query.where || {}));
    return res.deletedCount || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    const col = await this.getCollection(cls);
    const res = await col.insertOne(o);
    o.id = res.insertedId.toHexString();
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]): Promise<T[]> {
    const col = await this.getCollection(cls);
    for (const x of objs) {
      delete x.id;
    }
    const res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i].id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    const col = await this.getCollection(cls);
    this.prePersist(cls, o);
    await col.replaceOne({ _id: o.id }, o);
    this.postLoad(cls, o);
    return o;
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    return await this.updatePartialByQuery(cls, { _id: data.id } as any, data);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    const col = await this.getCollection(cls);
    query = this.translateQueryIds(query);

    let final: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      final = { $set: extractSimple(final) };
    }

    const res = await col.findOneAndUpdate(extractWhereClause(query.where || {}), final, { returnOriginal: false });
    if (!res.value) {
      throw new BaseError('Object not found for updating');
    }
    const ret: T = res.value as T;
    this.postLoad(cls, ret);
    return ret;
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, data: Partial<T>) {
    const col = await this.getCollection(cls);
    query = this.translateQueryIds(query);

    let finalData: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      finalData = { $set: extractSimple(data) };
    }

    const res = await col.updateMany(extractWhereClause(query.where || {}), data);
    return res.matchedCount;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>) {
    const col = await this.getCollection(cls);
    const bulk = col.initializeUnorderedBulkOp({});
    let count = 0;

    (state.insert || []).forEach(p => {
      count++;
      bulk.insert({
        $set: p
      });
    });

    (state.update || []).forEach(p => {
      count++;
      bulk.find({ _id: new mongo.ObjectId(p.id) }).update({
        $set: p
      });
    });

    (state.delete || []).forEach(p => {
      count++;
      bulk.find({ _id: new mongo.ObjectID(p.id) }).removeOne();
    });

    const out: BulkResponse = {
      count: {
        delete: 0,
        update: 0,
        insert: 0
      }
    };

    if (count > 0) {
      const res = await bulk.execute({});

      if (out.count) {
        out.count.delete = res.nRemoved;
        out.count.update = res.nUpdated;
        out.count.insert = res.nInserted;
      }

      if (res.hasWriteErrors()) {
        out.error = res.getWriteErrors();
      }
    }

    return out;
  }
}