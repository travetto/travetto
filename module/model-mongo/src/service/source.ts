import * as mongo from 'mongodb';
import * as flat from 'flat';
import * as _ from 'lodash';

import {
  ModelSource, IndexConfig, Query,
  QueryOptions, BulkState, BulkResponse,
  ModelRegistry, ModelCore,
  MatchQuery,
  PageableModelQuery,
  WhereClause
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { ModelMongoConfig } from './config';
import { Class } from '@travetto/registry';
import { FieldType } from '@travetto/model/src/model/query/common';
import { BaseError } from '@travetto/base';

function isFieldType(o: any): o is FieldType {
  const type = typeof o;
  return (Array.isArray(o) && o.length === 2 && typeof o[0] === 'number')
    || o === 'number' || o === 'string'
    || o === 'boolean' || o instanceof Date;
}

export function projectQuery(o: any, path: string = ''): any {
  let out: any = {};

  if (Array.isArray(o)) {
    return o.map(x => projectQuery(x));
  } else if (_.isPlainObject(o)) {
    for (const k of Object.keys(o)) {
      const sub = `${path}${k}`;
      if (k.startsWith('$')) {
        if (path) {
          out = { ...out, [path.replace(/[.]$/, '')]: { [k]: projectQuery(o[k]) } };
        } else {
          out = { ...out, [k]: projectQuery(o[k]) };
        }
      } else if (_.isPlainObject(o[k])) {
        out = { ...out, ...projectQuery(o[k], `${sub}.`) };
      } else {
        out[sub] = projectQuery(o[k]);
      }
    }
    return out;
  } else {
    return o;
  }
}

export class ModelMongoSource extends ModelSource {

  private client: mongo.MongoClient;
  private db: mongo.Db;
  private indices: { [key: string]: IndexConfig<any>[] } = {};

  constructor(private config: ModelMongoConfig) {
    super();
  }

  query<T extends ModelCore, U>(cls: Class<T>, o: T): U[] {
    return null as any;
  }

  buildQuery<T extends ModelCore>(query: Query<T>) {
    const out = {};
    if (query.where) {

    }
    if (query.select) {

    }
    if (query.sort) {

    }
    return out;
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

  translateQueryIds<T extends ModelCore>(query: Query<T>) {
    const where = (query.where || {}) as WhereClause<T & { _id: any }>;
    const val: any = where.id;
    if (val) {
      if (Array.isArray(val) || typeof val === 'string') {
        let res: (any[] | string | mongo.ObjectID) = val;
        if (typeof val === 'string') {
          res = new mongo.ObjectID(val);
        } else {
          res = val.map(x => typeof x === 'string' ? new mongo.ObjectID(x) : x);
        }
        delete where.id;
        (where as any)._id = res;
      } else if (Array.isArray(val.$in)) {
        const res: { $in: (string | mongo.ObjectID)[] } = val;
        val.$in = res.$in.map(x => typeof x === 'string' ? new mongo.ObjectID(x) : x);
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

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T>) {
    const col = await this.getCollection(cls);
    const objs = await col.find(query as mongo.FilterQuery<T>, { fields: { _id: 1 } } as any).toArray() as T[];
    return objs.map(x => this.postLoad(cls, x));
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T> = {}, options: QueryOptions<T> = {}): Promise<T[]> {
    query = this.translateQueryIds(query);

    console.log(cls.__id, query.where);

    const col = await this.getCollection(cls);
    let cursor = col.find(query.where);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }

    cursor = cursor.limit(Math.trunc(options.limit || 200) || 200);

    if (options.offset) {
      cursor = cursor.skip(Math.trunc(options.offset) || 0);
    }
    const res = await cursor.toArray() as any as T[];
    res.forEach(r => this.postLoad(cls, r));
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T> = {}): Promise<number> {
    query = this.translateQueryIds(query);

    const col = await this.getCollection(cls);
    const cursor = col.count(query.where!);

    const res = await cursor;
    return res;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}, failOnMany = true): Promise<T> {
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

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T> = {}): Promise<number> {
    query = this.translateQueryIds(query);
    const col = await this.getCollection(cls);
    const res = await col.deleteMany(query);
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

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T>, data: Partial<T>): Promise<T> {
    const col = await this.getCollection(cls);
    query = this.translateQueryIds(query);

    let final: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      final = { $set: flat(final) };
    }

    const res = await col.findOneAndUpdate(query, final, { returnOriginal: false });
    if (!res.value) {
      throw new BaseError('Object not found for updating');
    }
    const ret: T = res.value as T;
    this.postLoad(cls, ret);
    return ret;
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T> = {}, data: Partial<T>) {
    const col = await this.getCollection(cls);
    query = this.translateQueryIds(query);

    let finalData: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      finalData = { $set: flat(data) };
    }

    const res = await col.updateMany(query, data);
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