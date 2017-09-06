import * as mongo from 'mongodb';
import * as flat from 'flat';
import * as _ from 'lodash';

import { ModelSource, IndexConfig, Query, QueryOptions, BulkState, BulkResponse, ModelRegistry } from '@encore/model';
import { Injectable } from '@encore/di';
import { ModelMongoConfig } from './config';
import { Class } from '@encore/schema';
export interface Base {
  _id: string;
}

@Injectable()
export class MongoService extends ModelSource {

  private client: mongo.Db;
  private indices: { [key: string]: IndexConfig[] } = {};

  constructor(private config: ModelMongoConfig) {
    super();
  }

  idField = '_id';
  typeField = '_type';

  getIdField() {
    return this.idField;
  }

  getTypeField() {
    return this.typeField;
  }

  postLoad<T extends Base>(o: T) {
    if (o._id) {
      o._id = (o._id as any as mongo.ObjectId).toHexString();
    }
    return o;
  }

  prePersist<T extends Base>(o: T) {
    if (o._id) {
      o._id = new mongo.ObjectId(o._id) as any;
    }
    return o;
  }

  async postConstruct() {
    await this.init();
  }

  async init() {
    this.client = await mongo.MongoClient.connect(this.config.url);
    await this.establishIndices();
  }

  async establishIndices() {
    let promises = [];

    for (let colName of Object.keys(this.indices)) {
      let col = await this.client.collection(colName);

      for (let [fields, config] of this.indices[colName]) {
        promises.push(col.createIndex(fields, config));
      }
    }

    return Promise.all(promises);
  }

  translateQueryIds<T extends Base>(query: Query<T>) {
    if (query._id) {
      if (typeof query._id === 'string') {
        query._id = new mongo.ObjectID(query._id) as any;
      } else if (_.isPlainObject(query._id)) {
        if (query._id['$in']) {
          query._id['$in'] = query._id['$in'].map((x: any) => typeof x === 'string' ? new mongo.ObjectID(x) : x);
        }
      }
    }
    return query;
  }

  getCollectionName<T>(named: Class<T>): string {
    return ModelRegistry.getOptions(named).collection || named.name;
  }

  async getCollection<T>(named: Class<T>): Promise<mongo.Collection> {
    return this.client.collection(this.getCollectionName(named));
  }

  async resetDatabase() {
    await this.client.dropDatabase();
    await this.init();
  }

  registerIndex(named: Class, fields: { [key: string]: number }, config: mongo.IndexOptions) {
    let col = this.getCollectionName(named);
    this.indices[col] = this.indices[col] || [];
    this.indices[col].push([fields, config]);
  }

  getIndices(named: Class) {
    return this.indices[this.getCollectionName(named)];
  }

  async getIdsByQuery<T>(named: Class<T>, query: Query<T>) {
    let col = await this.getCollection(named);
    let objs = await col.find(query, { _id: true }).toArray();
    return objs.map(x => this.postLoad(x));
  }

  async getAllByQuery<T extends Base>(named: Class<T>, query: Query<T> = {}, options: QueryOptions = {}): Promise<T[]> {
    query = this.translateQueryIds(query);

    let col = await this.getCollection(named);
    let cursor = col.find(query);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }

    cursor = cursor.limit(Math.trunc(options.limit || 200) || 200);

    if (options.offset) {
      cursor = cursor.skip(Math.trunc(options.offset) || 0);
    }
    let res = await cursor.toArray();
    res.forEach(r => this.postLoad(r));
    return res;
  }

  async getCountByQuery<T extends Base>(named: Class<T>, query: Query<T> = {}, options: QueryOptions = {}): Promise<number> {
    query = this.translateQueryIds(query);

    let col = await this.getCollection(named);
    let cursor = col.count(query);

    let res = await cursor;
    return res;
  }

  async getByQuery<T extends Base>(named: Class<T>, query: Query<T> = {}, options: QueryOptions = {}, failOnMany = true): Promise<T> {
    if (!options.limit) {
      options.limit = 2;
    }
    let res = await this.getAllByQuery<T>(named, query, options);
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends Base>(named: Class<T>, id: string): Promise<T> {
    return await this.getByQuery<T>(named, { _id: id });
  }

  async deleteById(named: Class, id: string): Promise<number> {
    let col = await this.getCollection(named);
    let res = await col.deleteOne({ _id: new mongo.ObjectID(id) });

    return res.deletedCount || 0;
  }

  async deleteByQuery<T extends Base>(named: Class<T>, query: Query<T> = {}): Promise<number> {
    query = this.translateQueryIds(query);
    let col = await this.getCollection(named);
    let res = await col.deleteMany(query);
    return res.deletedCount || 0;
  }

  async save<T extends Base>(named: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    let col = await this.getCollection(named);
    if (removeId) {
      delete o._id;
    }
    let res = await col.insertOne(o);
    o._id = res.insertedId.toHexString();
    return o;
  }

  async saveAll<T extends Base>(named: Class<T>, objs: T[]): Promise<T[]> {
    let col = await this.getCollection(named);
    let res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i]._id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  async update<T extends Base>(named: Class<T>, o: T): Promise<T> {
    let col = await this.getCollection(named);
    this.prePersist(o);
    await col.replaceOne({ _id: o._id }, o);
    this.postLoad(o);
    return o;
  }

  async updatePartial<T extends Base>(named: Class<T>, id: string, data: any, opts: mongo.FindOneAndReplaceOption = {}): Promise<T> {
    return await this.updatePartialByQuery<T>(named, { _id: id }, data, opts);
  }

  async updatePartialByQuery<T extends Base>(named: Class<T>, query: Query<T> = {}, data: any, opts: mongo.FindOneAndReplaceOption = {}): Promise<T> {
    let col = await this.getCollection(named);
    query = this.translateQueryIds(query);

    if (Object.keys(data)[0].charAt(0) !== '$') {
      data = { $set: flat(data) };
    }

    let res = await col.findOneAndUpdate(query, data, Object.assign({ returnOriginal: false }, opts));
    if (!res.value) {
      throw new Error('Object not found for updating');
    }
    let ret: T = res.value as T;
    this.postLoad(ret);
    return ret;
  }

  async updateAll<T extends Base>(named: Class<T>, query: Query<T> = {}, data: Partial<T>) {
    let col = await this.getCollection(named);
    query = this.translateQueryIds(query);

    if (Object.keys(data)[0].charAt(0) !== '$') {
      data = { $set: flat(data) };
    }

    let res = await col.updateMany(query, data);
    return res.matchedCount;
  }

  async bulkProcess<T extends Base>(named: Class<T>, state: BulkState<T>) {
    let col = await this.getCollection(named);
    let bulk = col.initializeUnorderedBulkOp({});
    let count = 0;

    (state.upsert || []).forEach(p => {
      count++;
      let id: any = state.getId(p);
      if (id._id === undefined || id._id !== p._id) {
        delete p._id;
      } else {
        id._id = (p as any)._id = new mongo.ObjectID(p._id);
      }

      bulk.find(id).upsert().updateOne({
        $set: p
      });
    });

    (state.delete || []).forEach(p => {
      count++;
      bulk.find(state.getId(p)).removeOne();
    });

    let out: BulkResponse = {
      count: {
        delete: 0,
        update: 0,
        insert: 0
      }
    };

    if (count > 0) {
      let res = await bulk.execute({});
      let updatedCount = 0;

      if (out.count) {
        out.count.delete = res.nRemoved;
        out.count.update = updatedCount;
        out.count.update -= out.count.insert;
      }

      if (res.hasWriteErrors()) {
        out.error = res.getWriteErrors();
      }
    }

    return out;
  }
}