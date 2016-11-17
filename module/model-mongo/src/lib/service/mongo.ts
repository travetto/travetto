import * as mongo from "mongodb";
import Config from '../config';
import { Named, Base, BulkState, BulkResponse, QueryOptions } from '../model';
import { ObjectUtil } from '@encore/util';
const flat = require('flat');

export class MongoService {

  private static clientPromise: Promise<mongo.Db>;
  private static indices: any[] = [];

  static translateQueryIds(query: Object & { _id?: any }) {
    if (query._id) {
      if (typeof query._id === 'string') {
        query._id = new mongo.ObjectID(query._id);
      } else if (ObjectUtil.isPlainObject(query._id)) {
        if (query._id['$in']) {
          query._id['$in'] = query._id['$in'].map((x: any) => typeof x === 'string' ? new mongo.ObjectID(x) : x);
        }
      }
    }
    return query;
  }

  static getClient(): Promise<mongo.Db> {
    if (!MongoService.clientPromise) {
      let url = `mongodb://${Config.host}:${Config.port}/${Config.schema}`;
      MongoService.clientPromise = mongo.MongoClient.connect(url)
    }
    return MongoService.clientPromise;
  }

  static getCollectionName(named: Named): string {
    return named.collection || named.name;
  }

  static async collection(named: Named): Promise<mongo.Collection> {
    let db = await MongoService.getClient();
    return db.collection(MongoService.getCollectionName(named));
  }

  static async resetDatabase() {
    let client = await MongoService.getClient();
    await client.dropDatabase();
    for (let args of MongoService.indices) {
      let col = client.collection(args[0]);
      await col.createIndex.apply(col, args.slice(1));
    }
  }

  static async createIndex(named: Named, config: { fields: string[], unique?: boolean, sparse?: boolean }) {
    let col = await MongoService.collection(named);
    let map = ObjectUtil.fromPairs(config.fields.map(x => [x, 1]) as [string, number][]);
    MongoService.indices.push([col.collectionName, map, config]);
    let res = await col.createIndex(map, config)
    return;
  }

  static async getByQuery<T extends Base>(named: Named, query: Object & { _id?: any } = {}, options: QueryOptions = {}): Promise<T[]> {
    query = MongoService.translateQueryIds(query);

    let col = await MongoService.collection(named);
    let cursor = col.find(query);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }

    cursor = cursor.limit(Math.trunc(options.limit || 200) || 200)

    if (options.offset) {
      cursor = cursor.skip(Math.trunc(options.offset) || 0);
    }
    let res = await cursor.toArray();
    res.forEach((r: any) => r._id = (r._id as any).toHexString())
    return res;
  }

  static async getCountByQuery(named: Named, query: Object & { _id?: any } = {}, options: QueryOptions = {}): Promise<{ count: number }> {
    query = MongoService.translateQueryIds(query);

    let col = await MongoService.collection(named);
    let cursor = col.count(query);

    let res = await cursor;
    return { count: res };
  }

  static async findOne<T extends Base>(named: Named, query: Object, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await MongoService.getByQuery(named, query, options);
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  static async getById<T extends Base>(named: Named, id: string): Promise<T> {
    return await MongoService.findOne<T>(named, { _id: new mongo.ObjectID(id) });
  }

  static async deleteById(named: Named, id: string): Promise<number> {
    let col = await MongoService.collection(named);
    let res = await col.deleteOne({ _id: new mongo.ObjectID(id) })
    return res.deletedCount || 0;
  }

  static async deleteByQuery(named: Named, query: Object & { _id?: any } = {}): Promise<number> {
    query = MongoService.translateQueryIds(query);

    let col = await MongoService.collection(named);
    let res = await col.deleteMany(query);
    return res.deletedCount || 0;
  }

  static async save<T extends Base>(named: Named, o: T): Promise<T> {
    let col = await MongoService.collection(named);
    delete o._id;
    let res = await col.insertOne(o);
    o._id = res.insertedId.toHexString();
    return o;
  }

  static async saveAll<T extends Base>(named: Named, objs: T[]): Promise<T[]> {
    let col = await MongoService.collection(named);
    let res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i]._id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  static async update<T extends Base>(named: Named, o: T): Promise<T> {
    let col = await MongoService.collection(named)
    o._id = (new mongo.ObjectID(o._id) as any);
    let obj = await col.replaceOne({ _id: o._id }, o);
    o._id = (o._id as any).toHexString();
    return o;
  }

  static async partialUpdate<T extends Base>(named: Named, id: string, data: any): Promise<T> {
    let col = await MongoService.collection(named);
    let obj = await col.updateOne({ _id: new mongo.ObjectID(id) }, { $set: flat(data) });
    return await MongoService.getById<T>(named, id);
  }

  static async bulkProcess<T extends Base>(named: Named, state: BulkState<T>) {
    let col = await MongoService.collection(named);
    let bulk = col.initializeUnorderedBulkOp({});
    let count = 0;

    let batchKey = `${Date.now()}_${Math.random().toString().replace(/\./g, '')}`;
    let updateKey = `update_${batchKey}`;
    let insertKey = `insert_${batchKey}`;

    let insert: { [key: string]: boolean } = {}, update: { [key: string]: boolean } = {};
    insert[insertKey] = true;
    update[updateKey] = true;

    (state.upsert || []).forEach(p => {
      count++;
      let id = state.getId(p);
      delete p._id;
      (p as any)[updateKey] = true;

      bulk.find(id).upsert().updateOne({
        $setOnInsert: insert,
        $set: p
      })
    });

    (state.delete || []).forEach(p => {
      count++;
      bulk.find(state.getId(p)).removeOne()
    });

    let out: BulkResponse = {
      count: {
        delete: 0,
        update: 0,
        insert: 0
      }
    }

    if (count > 0) {
      let res = await bulk.execute({});
      let updated = {}
      let updatedCount = 0;

      if (out.count) {
        out.count.delete = res.nRemoved;
        out.count.update = updatedCount;
        out.count.update = await col.find(update).count(false);
        out.count.insert = await col.find(insert).count(false);
        out.count.update -= out.count.insert;
      }

      await bulk.find(update).update({ $unset: [updateKey] });
      await bulk.find(insert).update({ $unset: [insertKey] });

      if (res.hasWriteErrors()) {
        out.error = res.getWriteErrors();
      }
    }

    return out;
  }
}