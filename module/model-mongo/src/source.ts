import * as mongo from 'mongodb';

import {
  ModelSource, Query,
  BulkResponse,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  BulkOp,
  Point,
  ModelQuery,
  ValidStringFields,
  ModelUtil
} from '@travetto/model';

import { Class } from '@travetto/registry';
import { AppError, ShutdownManager } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { SchemaRegistry, ALL_VIEW, FieldConfig } from '@travetto/schema';

import { MongoUtil } from './internal/util';
import { MongoModelConfig } from './config';

function hasRawId(o: any): o is { _id: mongo.ObjectID } {
  return '_id' in o;
}

/**
 * Mongo-based model source
 */
@Injectable()
export class MongoModelSource extends ModelSource {

  private client: mongo.MongoClient;
  private db: mongo.Db;

  constructor(private config: MongoModelConfig) {
    super();
  }

  async postConstruct() {
    await this.initClient();
    await this.initDatabase();
  }

  /**
   * Build a mongo identifier
   */
  generateId() {
    return new mongo.ObjectId().toHexString();
  }

  /**
   * Run a mongo query
   */
  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const col = await this.getCollection(cls);

    const projected = MongoUtil.extractTypedWhereClause(cls, query.where ?? {});

    console.debug('Query', query);

    let cursor = col.find<U>(projected);
    if (query.select) {
      const select = Object.keys(query.select)[0].startsWith('$') ? query.select : MongoUtil.extractSimple(query.select);
      // Remove id if not explicitly defined, and selecting fields directly
      if (!select['_id']) {
        const values = new Set([...Object.values(select)]);
        if (values.has(1) || values.has(true)) {
          select['_id'] = false;
        }
      }
      cursor.project(select);
    }

    if (query.sort) {
      cursor = cursor.sort(query.sort.map(x => MongoUtil.extractSimple(x)));
    }

    cursor = cursor.limit(Math.trunc(query.limit ?? 200));

    if (query.offset) {
      cursor = cursor.skip(Math.trunc(query.offset ?? 0));
    }

    return await cursor.toArray();
  }

  /**
   * Convert ids on load
   */
  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    if (hasRawId(o)) {
      o.id = (o._id as mongo.ObjectId).toHexString();
      delete o._id;
    }
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    return o;
  }

  /**
   * Initialize client
   */
  async initClient() {
    this.client = await mongo.MongoClient.connect(this.config.url, this.config.clientOptions);
    this.db = this.client.db();
    ShutdownManager.onShutdown(__filename, () => this.client.close());
  }

  /**
   * Initialize db, setting up indicies
   */
  async initDatabase() {
    // Establish geo indices
    const promises: Promise<any>[] = [];
    for (const model of ModelRegistry.getClasses()) {
      promises.push(...this.establishIndices(model));
    }
    await Promise.all(promises);
  }

  /**
   * Drop all collections
   */
  async clearDatabase() {
    await this.db.dropDatabase();
  }

  /**
   * Establish an index
   */
  establishIndices<T extends ModelCore>(cls: Class<T>) {
    const promises: Promise<any>[] = [];
    for (const idx of ModelRegistry.get(cls).indices) {
      const [first, ...rest] = idx.fields;
      rest.reduce((acc, f) => ({ ...acc, f }), first);
      console.debug('Creating index', first, idx.options);
      promises.push(
        this.getCollection(cls)
          .then((col) => col.createIndex(first, idx.options)));
    }
    promises.push(this.establishGeoIndices(cls));
    return promises;
  }

  /**
   * Build a geo index
   */
  async establishGeoIndices<T extends ModelCore>(cls: Class<T>, path: FieldConfig[] = [], root = cls) {
    const fields = SchemaRegistry.has(cls) ?
      Object.values(SchemaRegistry.get(cls).views[ALL_VIEW].schema) :
      [];
    for (const field of fields) {
      if (SchemaRegistry.has(field.type)) {
        await this.establishGeoIndices(field.type, [...path, field], root);
      } else if (field.type === Point) {
        const col = await this.getCollection(root);
        const name = [...path, field].map(x => x.name).join('.');
        await col.createIndex({ [name]: '2d' });
      }
    }
  }

  /**
   * Get name of collection from a cls
   */
  getCollectionName<T extends ModelCore>(cls: Class<T>): string {
    cls = ModelRegistry.getBaseModel(cls);
    return ModelRegistry.getCollectionName(cls);
  }

  /**
   * Get mongo collection
   */
  async getCollection<T extends ModelCore>(cls: Class<T>): Promise<mongo.Collection> {
    return this.db.collection(this.getCollectionName(cls));
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    const res = await this.query(cls, query);
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const col = await this.getCollection(cls);
    const cursor = col.count(MongoUtil.extractTypedWhereClause(cls, query.where ?? {}));

    return await cursor;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 2, ...query });
    return ModelUtil.verifyGetSingleCounts(cls, res, failOnMany);
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    // @ts-ignore
    const query = { where: { id } } as ModelQuery<T>;
    return await this.getByQuery(cls, query);
  }

  async suggest<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    const q = ModelUtil.getSuggestFieldQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelUtil.combineSuggestResults(cls, field, prefix, results, (a) => a, query && query.limit);
  }

  /**
   * Facet using the aggregation pipeline
   */
  async facet<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const col = await this.getCollection(cls);
    const pipeline: object[] = [{
      $group: {
        _id: `$${field}`,
        count: {
          $sum: 1
        }
      }
    }];

    if (query && query.where) {
      pipeline.unshift({
        $match: MongoUtil.extractTypedWhereClause(cls, query.where)
      });
    }

    const result = await col.aggregate(pipeline).toArray();

    return result.map((val: any) => ({
      key: val._id,
      count: val.count
    })).sort((a, b) => b.count - a.count);
  }

  async suggestEntities<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const q = ModelUtil.getSuggestQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelUtil.combineSuggestResults(cls, field, prefix, results, (a, b) => b, query && query.limit);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const col = await this.getCollection(cls);
    const conf = ModelRegistry.get(cls);
    const res = await col.deleteOne({ _id: new mongo.ObjectId(id), ...(conf.subType ? { type: conf.subType } : {}) });

    return res.deletedCount ?? 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const col = await this.getCollection(cls);
    const res = await col.deleteMany(MongoUtil.extractTypedWhereClause(cls, query.where ?? {}));
    return res.deletedCount ?? 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId: boolean = false): Promise<T> {
    const col = await this.getCollection(cls);
    if (!keepId) {
      delete o.id;
    } else {
      // @ts-ignore
      o._id = new mongo.ObjectId(o.id); // To mongo
      delete o.id;
    }
    const res = await col.insertOne(o);
    o.id = res.insertedId.toHexString();
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[], keepId: boolean = false): Promise<T[]> {
    const col = await this.getCollection(cls);
    for (const o of objs) {
      if (!keepId) {
        delete o.id;
      } else {
        // @ts-ignore
        o._id = new mongo.ObjectId(o.id); // To mongo
        delete o.id;
      }
    }
    const res = await col.insertMany(objs);
    for (let i = 0; i < objs.length; i++) {
      objs[i].id = res.insertedIds[i].toHexString();
    }
    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    o = this.prePersist(cls, o);
    const id = new mongo.ObjectId(o.id!);
    delete o.id;

    const col = await this.getCollection(cls);
    const conf = ModelRegistry.get(cls);
    const res = await col.replaceOne({ _id: id, ...(conf.subType ? { type: conf.subType } : {}) }, o);
    if (res.matchedCount === 0) {
      throw new AppError(`Invalid update, no ${cls.name} found with id '${id}'`, 'notfound');
    }
    return this.getById(cls, id.toHexString());
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T>): Promise<T> {
    return await this.updatePartialByQuery(cls, { where: { id: data.id } } as ModelQuery<T>, data);
  }

  /**
   * Update partial by using $set operations
   */
  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    const col = await this.getCollection(cls);

    let final: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      const items = MongoUtil.extractSimple(final);
      final = Object.entries(items).reduce((acc, [k, v]) => {
        if (v === null || v === undefined) {
          acc.$unset = acc.$unset ?? {};
          acc.$unset[k] = v;
        } else {
          acc.$set = acc.$set ?? {};
          acc.$set[k] = v;
        }
        return acc;
      }, {} as Record<string, any>);
    }

    const res = await col.findOneAndUpdate(MongoUtil.extractTypedWhereClause(cls, query.where ?? {}), final, { returnOriginal: false });
    if (!res.value) {
      throw new AppError('Object not found for updating', 'notfound');
    }

    const ret: T = res.value as T;
    return ret;
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, data: Partial<T>) {
    const col = await this.getCollection(cls);

    const res = await col.updateMany(MongoUtil.extractTypedWhereClause(cls, query.where ?? {}), data);
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
      for (const { index, _id } of res.getUpsertedIds() as { index: number, _id: mongo.ObjectID }[]) {
        out.insertedIds.set(index, _id.toHexString());
      }

      if (out.counts) {
        out.counts.delete = res.nRemoved;
        out.counts.update = operations.filter(x => x.update).length;
        out.counts.insert = res.nInserted;
        out.counts.upsert = operations.filter(x => x.upsert).length;
      }

      if (res.hasWriteErrors()) {
        out.errors = res.getWriteErrors();
        for (const err of out.errors) {
          const op = operations[err.index];
          const k = Object.keys(op)[0] as keyof BulkResponse['counts'];
          out.counts[k] -= 1;
        }
        out.counts.error = out.errors.length;
      }
    }

    return out;
  }
}