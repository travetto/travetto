import * as mongo from 'mongodb';

import {
  ModelRegistry, ModelType,
  ModelCrudSupport,
  ModelStorageSupport,
  ModelStreamSupport,
  StreamMeta,
  BulkOp,
  BulkResponse,
  ModelBulkSupport,
  NotFoundError,
  ExistsError,
  ModelIndexedSupport
} from '@travetto/model';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySupport,
  PageableModelQuery, ValidStringFields
} from '@travetto/model-query';

import { ShutdownManager, Util, Class } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { ALL_VIEW, FieldConfig, SchemaRegistry, SchemaValidator } from '@travetto/schema';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { PointImpl } from '@travetto/model-query/src/internal/model/point';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';

import { MongoUtil, WithId } from './internal/util';
import { MongoModelConfig } from './config';

/**
 * Mongo-based model source
 */
@Injectable()
export class MongoModelService implements
  ModelCrudSupport, ModelStorageSupport,
  ModelBulkSupport, ModelStreamSupport,
  ModelIndexedSupport, ModelQuerySupport,
  ModelQueryCrudSupport, ModelQueryFacetSupport {

  private client: mongo.MongoClient;
  private db: mongo.Db;
  private bucket: mongo.GridFSBucket;

  constructor(public readonly config: MongoModelConfig) {
  }

  async postConstruct() {
    this.client = await mongo.MongoClient.connect(this.config.url, this.config.clientOptions);
    this.db = this.client.db();
    this.bucket = new mongo.GridFSBucket(this.db, {
      bucketName: 'streams',
      writeConcern: { w: 1 }
    });
    ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.close());
    ModelExpiryUtil.registerCull(this);
  }

  /**
   * Build a mongo identifier
   */
  uuid() {
    return Util.uuid();
  }

  async createStorage() { }

  async deleteStorage() {
    await this.db.dropDatabase();
  }

  getGeoIndices<T extends ModelType>(cls: Class<T>, path: FieldConfig[] = [], root = cls): Record<string, '2d'>[] {
    const fields = SchemaRegistry.has(cls) ?
      Object.values(SchemaRegistry.get(cls).views[ALL_VIEW].schema) :
      [];
    const out: Record<string, '2d'>[] = [];
    for (const field of fields) {
      if (SchemaRegistry.has(field.type)) {
        // Recurse
        out.push(...this.getGeoIndices(field.type, [...path, field], root));
      } else if (field.type === PointImpl) {
        const name = [...path, field].map(x => x.name).join('.');
        console.debug('Preparing geo-index', { cls: root.ᚕid, name });
        out.push({ [name]: '2d' });
      }
    }
    return out;
  }

  getIndicies<T extends ModelType>(cls: Class<T>) {
    const indices = ModelRegistry.get(cls).indices ?? [];
    return [
      ...indices.map(idx => {
        const combined = Object.assign({}, ...idx.fields) as Record<string, number>;
        return [combined, { unique: idx.unique } as mongo.IndexOptions] as const;
      }),
      ...this.getGeoIndices(cls).map(x => [x] as const)
    ];
  }

  async establishIndices<T extends ModelType>(cls: Class<T>) {
    const col = await this.getStore(cls);
    const creating = this.getIndicies(cls);
    if (creating.length) {
      console.debug('Creating indexes', { indices: creating });
      for (const el of creating) {
        await col.createIndex(el[0], el[1]);
      }
    }
  }

  async createModel(cls: Class) {
    await this.establishIndices(cls);
  }

  async changeModel(cls: Class) {
    await this.establishIndices(cls);
  }

  /**
   * Get mongo collection
   */
  async getStore<T extends ModelType>(cls: Class<T>): Promise<mongo.Collection> {
    return this.db.collection(ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_'));
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const store = await this.getStore(cls);
    const result = await store.findOne({ _id: MongoUtil.uuid(id), }, {});
    if (result) {
      const res = await ModelCrudUtil.load(cls, result);
      if (res) {
        return MongoUtil.postLoadId(res);
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    const cleaned = await ModelCrudUtil.preStore(cls, item, this);
    (item as WithId<T>)._id = MongoUtil.uuid(item.id!);

    const store = await this.getStore(cls);
    const result = await store.insertOne(cleaned);
    if (result.insertedCount === 0) {
      throw new ExistsError(cls, item.id!);
    }
    delete (item as WithId<T>)._id;
    return item;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const store = await this.getStore(cls);
    const res = await store.replaceOne({ _id: MongoUtil.uuid(item.id!) }, item);
    if (res.matchedCount === 0) {
      throw new NotFoundError(cls, item.id!);
    }
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const store = await this.getStore(cls);
    await store.updateOne(
      { _id: MongoUtil.uuid(item.id!) },
      { $set: item },
      { upsert: true }
    );
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    const store = await this.getStore(cls);

    if (view) {
      await SchemaValidator.validate(cls, item, view);
    }

    if (item.prePersist) {
      await item.prePersist();
    }

    let final: Record<string, unknown> = item;

    const items = MongoUtil.extractSimple(final);
    final = Object.entries(items).reduce((acc, [k, v]) => {
      if (v === null || v === undefined) {
        const o = (acc.$unset = acc.$unset ?? {}) as Record<string, unknown>;
        o[k] = v;
      } else {
        const o = (acc.$set = acc.$set ?? {}) as Record<string, unknown>;
        o[k] = v;
      }
      return acc;
    }, {} as Record<string, unknown>);

    const res = await store.findOneAndUpdate({ _id: MongoUtil.uuid(id) }, final, { returnOriginal: false });

    if (!res.value) {
      new NotFoundError(cls, id);
    }

    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const store = await this.getStore(cls);
    const result = await store.deleteOne({ _id: MongoUtil.uuid(id) });
    if (result.deletedCount === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    const store = await this.getStore(cls);
    for await (const el of store.find()) {
      try {
        yield MongoUtil.postLoadId(await ModelCrudUtil.load(cls, el));
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }
    }
  }

  async upsertStream(location: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const writeStream = this.bucket.openUploadStream(location, {
      contentType: meta.contentType,
      metadata: meta
    });

    await new Promise<unknown>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', reject);
      writeStream.once('finish', resolve);
    });
  }

  async getStream(location: string) {
    await this.getStreamMetadata(location);

    const res = await this.bucket.openDownloadStreamByName(location);
    if (!res) {
      throw new NotFoundError('stream', location);
    }
    return res;
  }

  async getStreamMetadata(location: string) {
    const files = await this.bucket.find({ filename: location }, { limit: 1 }).toArray();

    if (!files || !files.length) {
      throw new NotFoundError('stream', location);
    }

    const [f] = files;
    return f.metadata;
  }

  async deleteStream(location: string) {
    const files = await this.bucket.find({ filename: location }).toArray();
    const [{ _id: bucketId }] = files;
    await this.bucket.delete(bucketId);
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]) {
    const store = await this.getStore(cls);
    const bulk = store.initializeUnorderedBulkOp({ w: 1 });
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
        op.insert = await ModelCrudUtil.preStore(cls, op.insert, this);
        out.insertedIds.set(i, op.insert.id!);
        bulk.insert(MongoUtil.preInsertId(op.insert));
      } else if (op.upsert) {
        const newId = !op.upsert.id;
        op.upsert = await ModelCrudUtil.preStore(cls, op.upsert, this);
        const id = MongoUtil.uuid(op.upsert.id!);
        bulk.find({ _id: id })
          .upsert()
          .updateOne({ $set: op.upsert });

        if (newId) {
          out.insertedIds.set(i, op.upsert.id!);
        }
      } else if (op.update) {
        op.update = await ModelCrudUtil.preStore(cls, op.update, this);
        bulk.find({ _id: MongoUtil.uuid(op.update.id!) }).update({ $set: op.update });
      } else if (op.delete) {
        bulk.find({ _id: MongoUtil.uuid(op.delete.id!) }).removeOne();
      }
    }

    if (operations.length > 0) {
      const res = await bulk.execute({});

      for (const el of operations) {
        if (el.insert) {
          MongoUtil.postLoadId(el.insert);
        }
      }
      for (const { index, _id } of res.getUpsertedIds() as { index: number, _id: mongo.ObjectID }[]) {
        out.insertedIds.set(index, MongoUtil.idToString(_id));
      }

      if (out.counts) {
        out.counts.delete = res.nRemoved;
        out.counts.update = operations.filter(x => x.update).length;
        out.counts.insert = res.nInserted;
        out.counts.upsert = operations.filter(x => x.upsert).length;
      }

      if (res.hasWriteErrors()) {
        out.errors = res.getWriteErrors();
        for (const err of out.errors as { index: number }[]) {
          const op = operations[err.index];
          const k = Object.keys(op)[0] as keyof BulkResponse['counts'];
          out.counts[k] -= 1;
        }
        out.counts.error = out.errors.length;
      }
    }

    return out;
  }

  // Expiry
  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const item = await this.get(cls, id);
    return ModelExpiryUtil.getExpiryForItem(cls, item);
  }

  deleteExpired<T extends ModelType>(cls: Class<T>) {
    return ModelQueryExpiryUtil.deleteExpired(this, cls);
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const store = await this.getStore(cls);
    const result = await store.findOne(ModelIndexedUtil.projectIndex(cls, idx, body, null));
    if (!result) {
      throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
    }
    return await ModelCrudUtil.load(cls, result);
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const store = await this.getStore(cls);
    const result = await store.deleteOne(ModelIndexedUtil.projectIndex(cls, idx, body, null));
    if (result.deletedCount) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
  }

  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    const col = await this.getStore(cls);
    const { filter } = MongoUtil.prepareQuery(cls, query);
    console.info('Query', { query: JSON.stringify(query, null, 2) });
    let cursor = col.find<T>(filter, {});
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
      cursor = cursor.sort(Object.assign({}, ...query.sort.map(x => MongoUtil.extractSimple(x))));
    }

    cursor = cursor.limit(Math.trunc(query.limit ?? 200));

    if (query.offset && typeof query.offset === 'number') {
      cursor = cursor.skip(Math.trunc(query.offset ?? 0));
    }

    const items = await cursor.toArray();
    return await Promise.all(items.map(r => ModelCrudUtil.load(cls, r).then(MongoUtil.postLoadId)));
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    const col = await this.getStore(cls);
    const { filter } = MongoUtil.prepareQuery(cls, query);
    return col.countDocuments(filter);
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany = false): Promise<T> {
    const results = await this.query(cls, { ...query, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts(cls, results, failOnMany);
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    const col = await this.getStore(cls);
    const { filter } = MongoUtil.prepareQuery(cls, query);
    const res = await col.deleteMany(filter);
    return res.deletedCount ?? 0;
  }

  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {
    const col = await this.getStore(cls);

    const items = MongoUtil.extractSimple(data);
    const final = Object.entries(items).reduce((acc, [k, v]) => {
      if (v === null || v === undefined) {
        const o = (acc.$unset = acc.$unset ?? {}) as Record<string, unknown>;
        o[k] = v;
      } else {
        const o = (acc.$set = acc.$set ?? {}) as Record<string, unknown>;
        o[k] = v;
      }
      return acc;
    }, {} as Record<string, unknown>);

    const { filter } = MongoUtil.prepareQuery(cls, query);
    const res = await col.updateMany(filter, final);
    return res.matchedCount;
  }

  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    const q = ModelQuerySuggestUtil.getSuggestFieldQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, (a) => a, query && query.limit);
  }

  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const col = await this.getStore(cls);
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
        $match: MongoUtil.prepareQuery(cls, query).filter
      });
    }

    const result = await col.aggregate(pipeline).toArray();

    return result.map((val: ({ _id: string, count: number })) => ({
      key: val._id,
      count: val.count
    })).sort((a, b) => b.count - a.count);
  }

  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const q = ModelQuerySuggestUtil.getSuggestQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, (a, b) => b, query && query.limit);
  }
}