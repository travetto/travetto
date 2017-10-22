import * as mongo from 'mongodb';
import * as flat from 'flat';
import * as _ from 'lodash';

import {
  ModelSource, IndexConfig, Query,
  QueryOptions, BulkState, BulkResponse,
  ModelRegistry, ModelCore, FieldQuery,
  MatchQuery, isQuery, isFieldType
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { ModelMongoConfig } from './config';
import { Class } from '@travetto/registry';

@Injectable({ target: ModelSource })
export class ModelMongoSource extends ModelSource {

  private client: mongo.Db;
  private indices: { [key: string]: IndexConfig[] } = {};

  constructor(private config: ModelMongoConfig) {
    super();
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
    await this.establishIndices();
  }

  async establishIndices() {
    let promises = [];

    for (let colName of Object.keys(this.indices)) {
      let col = await this.client.collection(colName);

      for (let { fields, options } of this.indices[colName]) {
        promises.push(col.createIndex(fields, options));
      }
    }
    return Promise.all(promises);
  }

  translateQueryIds<T extends ModelCore>(query: Query) {
    if (!isQuery(query)) {
      let val = query._id;
      if (val) {
        if (!isFieldType(val) && val.in) {
          val.in = val.in.map((x: any) => typeof x === 'string' ? new mongo.ObjectID(x) : x);
        } else if (typeof val === 'string') {
          query._id = new mongo.ObjectID(val) as any;
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

  registerIndex(cls: Class, fields: { [key: string]: number }, options: mongo.IndexOptions) {
    let col = this.getCollectionName(cls);
    this.indices[col] = this.indices[col] || [];

    // TODO: Cleanup
    this.indices[col].push({ fields, options });
  }

  getIndices(cls: Class) {
    return this.indices[this.getCollectionName(cls)];
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query) {
    let col = await this.getCollection(cls);
    let objs = await col.find(query, { _id: true }).toArray();
    return objs.map(x => this.postLoad(cls, x));
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
    res.forEach(r => this.postLoad(cls, r));
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}): Promise<number> {
    query = this.translateQueryIds(query);

    let col = await this.getCollection(cls);
    let cursor = col.count(query);

    let res = await cursor;
    return res;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}, failOnMany = true): Promise<T> {
    let res = await this.getAllByQuery(cls, query, { limit: 200, ...options });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    return await this.getByQuery(cls, { _id: id });
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
    let res = await col.insertOne(o);
    o.id = res.insertedId.toHexString();
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]): Promise<T[]> {
    let col = await this.getCollection(cls);
    for (let x of objs) {
      delete x.id;
    }
    let res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i].id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    let col = await this.getCollection(cls);
    this.prePersist(cls, o);
    await col.replaceOne({ _id: o.id }, o);
    this.postLoad(cls, o);
    return o;
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    return await this.updatePartialByQuery(cls, { _id: data.id }, data);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: Query, data: Partial<T>): Promise<T> {
    let col = await this.getCollection(cls);
    query = this.translateQueryIds(query);

    let final: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      final = { $set: flat(final) };
    }

    let res = await col.findOneAndUpdate(query, final, Object.assign({ returnOriginal: false }, {}));
    if (!res.value) {
      throw new Error('Object not found for updating');
    }
    let ret: T = res.value as T;
    this.postLoad(cls, ret);
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

    let out: BulkResponse = {
      count: {
        delete: 0,
        update: 0,
        insert: 0
      }
    };

    if (count > 0) {
      let res = await bulk.execute({});

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