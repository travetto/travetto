import * as mongo from 'mongodb';
import * as flat from 'flat';
import * as _ from 'lodash';

import { ModelSource, IndexConfig, Query, QueryOptions, BulkState, BulkResponse, ModelRegistry, ModelCore } from '@encore2/model';
import { Injectable } from '@encore2/di';
import { ModelMongoConfig } from './config';
import { Class } from '@encore2/registry';
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

  postLoad<T extends ModelCore>(o: T) {
    if (o.id) {
      o.id = (o.id as any as mongo.ObjectId).toHexString();
    }
    return o;
  }

  prePersist<T extends ModelCore>(o: T) {
    if (o.id) {
      o.id = new mongo.ObjectId(o.id) as any;
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

  translateQueryIds<T extends ModelCore>(query: Query) {
    if (query['_id']) {
      if (typeof query.id === 'string') {
        query.id = new mongo.ObjectID(query.id) as any;
      } else if (_.isPlainObject(query.id)) {
        if (query.id['$in']) {
          query.id['$in'] = query.id['$in'].map((x: any) => typeof x === 'string' ? new mongo.ObjectID(x) : x);
        }
      }
    }
    return query;
  }

  getCollectionName<T extends ModelCore>(cls: Class<T>): string {
    return ModelRegistry.get(cls).collection || cls.name;
  }

  async getCollection<T extends ModelCore>(cls: Class<T>): Promise<mongo.Collection> {
    return this.client.collection(this.getCollectionName(cls));
  }

  async resetDatabase() {
    await this.client.dropDatabase();
    await this.init();
  }

  registerIndex(cls: Class, fields: { [key: string]: number }, config: mongo.IndexOptions) {
    let col = this.getCollectionName(cls);
    this.indices[col] = this.indices[col] || [];
    this.indices[col].push([fields, config]);
  }

  getIndices(cls: Class) {
    return this.indices[this.getCollectionName(cls)];
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query) {
    let col = await this.getCollection(cls);
    let objs = await col.find(query, { _id: true }).toArray();
    return objs.map(x => this.postLoad(x));
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}): Promise<T[]> {
    query = this.translateQueryIds(query);

    let col = await this.getCollection(cls);
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

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}): Promise<number> {
    query = this.translateQueryIds(query);

    let col = await this.getCollection(cls);
    let cursor = col.count(query);

    let res = await cursor;
    return res;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}, failOnMany = true): Promise<T> {
    if (!options.limit) {
      options.limit = 2;
    }
    let res = await this.getAllByQuery(cls, query, options);
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    return await this.getByQuery(cls, {
      $and: [{ _id: id }]
    });
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    let col = await this.getCollection(cls);
    let res = await col.deleteOne({ _id: new mongo.ObjectID(id) });

    return res.deletedCount || 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}): Promise<number> {
    query = this.translateQueryIds(query);
    let col = await this.getCollection(cls);
    let res = await col.deleteMany(query);
    return res.deletedCount || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    let col = await this.getCollection(cls);
    if (removeId) {
      delete o.id;
    }
    let res = await col.insertOne(o);
    o.id = res.insertedId.toHexString();
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]): Promise<T[]> {
    let col = await this.getCollection(cls);
    let res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i].id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    let col = await this.getCollection(cls);
    this.prePersist(o);
    await col.replaceOne({ _id: o.id }, o);
    this.postLoad(o);
    return o;
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, id: string, data: any, opts: mongo.FindOneAndReplaceOption = {}): Promise<T> {
    return await this.updatePartialByQuery(cls, { _id: id }, data, opts);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, data: any, opts: mongo.FindOneAndReplaceOption = {}): Promise<T> {
    let col = await this.getCollection(cls);
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

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, data: Partial<T>) {
    let col = await this.getCollection(cls);
    query = this.translateQueryIds(query);

    let finalData: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      finalData = { $set: flat(data) };
    }

    let res = await col.updateMany(query, data);
    return res.matchedCount;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>) {
    let col = await this.getCollection(cls);
    let bulk = col.initializeUnorderedBulkOp({});
    let count = 0;

    (state.upsert || []).forEach(p => {
      count++;
      let id: any = state.getId(p);
      if (id.id === undefined || id.id !== p.id) {
        delete p.id;
      } else {
        id.id = (p as any).id = new mongo.ObjectID(p.id);
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
        out.count.update -= (out.count.insert || 0);
      }

      if (res.hasWriteErrors()) {
        out.error = res.getWriteErrors();
      }
    }

    return out;
  }
}