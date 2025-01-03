import { pipeline } from 'node:stream/promises';

import { type Db, GridFSBucket, MongoClient, type GridFSFile, type Collection, type ObjectId, type Binary, type RootFilterOperators, Filter } from 'mongodb';

import {
  ModelRegistry, ModelType, OptionalId, ModelCrudSupport, ModelStorageSupport,
  ModelExpirySupport, ModelBulkSupport, ModelIndexedSupport, BulkOp, BulkResponse,
  NotFoundError, ExistsError, ModelBlobSupport
} from '@travetto/model';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySupport,
  PageableModelQuery, ValidStringFields, WhereClause, ModelQuerySuggestSupport,
  QueryVerifier
} from '@travetto/model-query';

import {
  ShutdownManager, type Class, type DeepPartial, TypedObject,
  castTo, asFull, BlobMeta, ByteRange, BinaryInput, BinaryUtil
} from '@travetto/runtime';
import { Injectable } from '@travetto/di';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelBulkUtil } from '@travetto/model/src/internal/service/bulk';
import { MODEL_BLOB, ModelBlobNamespace, ModelBlobUtil } from '@travetto/model/src/internal/service/blob';

import { MongoUtil, PlainIdx, WithId } from './internal/util';
import { MongoModelConfig } from './config';

const ListIndexⲐ = Symbol.for('@travetto/mongo-model:list-index');

type BlobRaw = GridFSFile & { metadata?: BlobMeta };

type MongoTextSearch = RootFilterOperators<unknown>['$text'];

/**
 * Mongo-based model source
 */
@Injectable()
export class MongoModelService implements
  ModelCrudSupport, ModelStorageSupport,
  ModelBulkSupport, ModelBlobSupport,
  ModelIndexedSupport, ModelQuerySupport,
  ModelQueryCrudSupport, ModelQueryFacetSupport,
  ModelQuerySuggestSupport, ModelExpirySupport {

  idSource = ModelCrudUtil.uuidSource();
  client: MongoClient;
  #db: Db;
  #bucket: GridFSBucket;

  constructor(public readonly config: MongoModelConfig) { }


  postLoad<T extends ModelType>(item: T & { _id?: unknown }): T {
    if (item._id) {
      item.id ??= MongoUtil.idToString(castTo(item._id));
      delete item._id;
    }
    return item;
  }

  postUpdate<T extends ModelType>(item: T & { _id?: unknown }): T {
    return this.postLoad(item);
  }

  preUpdate<T extends OptionalId<ModelType>>(item: T & { _id?: Binary, id: string }): string;
  preUpdate<T extends OptionalId<ModelType>>(item: Omit<T, 'id'> & { _id?: Binary }): undefined;
  preUpdate<T extends OptionalId<ModelType>>(item: T & { _id?: Binary, id: undefined }): undefined;
  preUpdate<T extends OptionalId<ModelType>>(item: T & { _id?: Binary, id?: string }): string | undefined {
    if (item && item.id) {
      const id = item.id;
      item._id = MongoUtil.uuid(id);
      if (!this.config.storeId) {
        delete item.id;
      }
      return id;
    }
  }

  async #describeBlobRaw(location: string): Promise<BlobRaw> {
    const files: BlobRaw[] = await this.#bucket.find({ filename: location }, { limit: 1 }).toArray();

    if (!files?.length) {
      throw new NotFoundError(ModelBlobNamespace, location);
    }

    return files[0];
  }

  async postConstruct(): Promise<void> {
    this.client = await MongoClient.connect(this.config.url, this.config.options);
    this.#db = this.client.db(this.config.namespace);
    this.#bucket = new GridFSBucket(this.#db, {
      bucketName: ModelBlobNamespace,
      writeConcern: { w: 1 }
    });
    await ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onGracefulShutdown(() => this.client.close(), this);
    ModelExpiryUtil.registerCull(this);
  }

  getWhereFilter<T extends ModelType>(cls: Class<T>, where: WhereClause<T>, checkExpiry = true): Filter<T> {
    return castTo(MongoUtil.extractWhereFilter(cls, where, checkExpiry));
  }

  getIdFilter<T extends ModelType>(cls: Class<T>, id: string, checkExpiry = true): Filter<T> {
    return this.getWhereFilter(cls, castTo({ _id: MongoUtil.uuid(id) }), checkExpiry);
  }

  // Storage
  async createStorage(): Promise<void> { }

  async deleteStorage(): Promise<void> {
    await this.#db.dropDatabase();
  }

  async establishIndices<T extends ModelType>(cls: Class<T>): Promise<void> {
    const col = await this.getStore(cls);
    const creating = MongoUtil.getIndices(cls, ModelRegistry.get(cls).indices);
    if (creating.length) {
      console.debug('Creating indexes', { indices: creating });
      for (const el of creating) {
        await col.createIndex(...el);
      }
    }
  }

  async createModel(cls: Class): Promise<void> {
    await this.establishIndices(cls);
  }

  async changeModel(cls: Class): Promise<void> {
    await this.establishIndices(cls);
  }

  async truncateModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    if (cls === MODEL_BLOB) {
      await this.#bucket.drop().catch(() => { });
    } else {
      const col = await this.getStore(cls);
      await col.deleteMany({});
    }
  }

  /**
   * Get mongo collection
   */
  async getStore<T extends ModelType>(cls: Class<T>): Promise<Collection<T>> {
    return this.#db.collection(ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_'));
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const store = await this.getStore(cls);
    const result = await store.findOne(this.getIdFilter(cls, id), {});
    if (result) {
      const res = await ModelCrudUtil.load(cls, this.postLoad(result));
      if (res) {
        return res;
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const cleaned = await ModelCrudUtil.preStore<WithId<T, Binary>>(cls, item, this);
    const id = this.preUpdate(cleaned);

    const store = await this.getStore(cls);
    const result = await store.insertOne(castTo(cleaned));
    if (!result.insertedId) {
      throw new ExistsError(cls, id);
    }
    return this.postUpdate(cleaned);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const id = this.preUpdate(item);
    const store = await this.getStore(cls);
    const res = await store.replaceOne(this.getIdFilter(cls, id), item);
    if (res.matchedCount === 0) {
      throw new NotFoundError(cls, id);
    }
    return this.postUpdate(item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const cleaned = await ModelCrudUtil.preStore<WithId<T, Binary>>(cls, item, this);
    const id = this.preUpdate(cleaned);
    const store = await this.getStore(cls);

    try {
      await store.updateOne(
        this.getIdFilter(cls, id, false),
        { $set: cleaned },
        { upsert: true }
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('duplicate key error')) {
        throw new ExistsError(cls, id);
      } else {
        throw err;
      }
    }
    return this.postUpdate(cleaned);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    const store = await this.getStore(cls);

    const final = await ModelCrudUtil.prePartialUpdate(cls, item, view);
    const simple = MongoUtil.extractSimple(cls, final, undefined, false);
    delete simple.id;

    const operation: Partial<T> = castTo(Object
      .entries(simple)
      .reduce<Partial<Record<'$unset' | '$set', Record<string, unknown>>>>((acc, [k, v]) => {
        if (v === null || v === undefined) {
          (acc.$unset ??= {})[k] = v;
        } else {
          (acc.$set ??= {})[k] = v;
        }
        return acc;
      }, {}));

    const id = item.id;

    const res = await store.findOneAndUpdate(
      this.getIdFilter(cls, id),
      operation,
      { returnDocument: 'after', includeResultMetadata: true }
    );

    if (!res.value) {
      throw new NotFoundError(cls, id);
    }

    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    const store = await this.getStore(cls);
    const result = await store.deleteOne(this.getIdFilter(cls, id, false));
    if (result.deletedCount === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    const store = await this.getStore(cls);
    const cursor = store.find(this.getWhereFilter(cls, {}), { timeout: true }).batchSize(100);
    for await (const el of cursor) {
      try {
        yield await ModelCrudUtil.load(cls, this.postLoad(el));
      } catch (err) {
        if (!(err instanceof NotFoundError)) {
          throw err;
        }
      }
    }
  }

  // Blob
  async upsertBlob(location: string, input: BinaryInput, meta?: BlobMeta, overwrite = true): Promise<void> {
    const existing = await this.getBlobMeta(location).then(() => true, () => false);
    if (!overwrite && existing) {
      return;
    }
    const [stream, blobMeta] = await ModelBlobUtil.getInput(input, meta);
    const writeStream = this.#bucket.openUploadStream(location, {
      contentType: blobMeta.contentType,
      metadata: blobMeta,
    });
    await pipeline(stream, writeStream);

    if (existing) {
      const [read] = await this.#bucket.find({ filename: location, _id: { $ne: writeStream.id } }).toArray();
      await this.#bucket.delete(read._id);
    }
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const meta = await this.getBlobMeta(location);
    const final = range ? ModelBlobUtil.enforceRange(range, meta.size!) : undefined;
    const mongoRange = final ? { start: final.start, end: final.end + 1 } : undefined;
    return BinaryUtil.readableBlob(() => this.#bucket.openDownloadStreamByName(location, mongoRange), { ...meta, range: final });
  }

  async getBlobMeta(location: string): Promise<BlobMeta> {
    const res = await this.#db.collection<{ metadata: BlobMeta }>(`${ModelBlobNamespace}.files`).findOne({ filename: location });
    return res!.metadata;
  }

  async deleteBlob(location: string): Promise<void> {
    const fileId = (await this.#describeBlobRaw(location))._id;
    await this.#bucket.delete(fileId);
  }

  async updateBlobMeta(location: string, meta: BlobMeta): Promise<void> {
    await this.#db.collection<{ metadata: BlobMeta }>(`${ModelBlobNamespace}.files`).findOneAndUpdate(
      { filename: location },
      { $set: { metadata: meta, contentType: meta.contentType! } },
    );
  }

  // Bulk
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse<{ index: number }>> {
    const out: BulkResponse<{ index: number }> = {
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

    if (operations.length === 0) {
      return out;
    }

    const store = await this.getStore<Partial<T> & ModelType>(cls);
    const bulk = store.initializeUnorderedBulkOp({ writeConcern: { w: 1 } });
    const { upsertedIds, insertedIds } = await ModelBulkUtil.preStore(cls, operations, this);

    out.insertedIds = new Map([...upsertedIds.entries(), ...insertedIds.entries()]);

    for (const op of operations) {
      if (op.insert) {
        this.preUpdate(op.insert);
        bulk.insert(op.insert);
      } else if (op.upsert) {
        const id = this.preUpdate(op.upsert);
        bulk.find({ _id: MongoUtil.uuid(id!) }).upsert().updateOne({ $set: op.upsert });
      } else if (op.update) {
        const id = this.preUpdate(op.update);
        bulk.find({ _id: MongoUtil.uuid(id) }).update({ $set: op.update });
      } else if (op.delete) {
        bulk.find({ _id: MongoUtil.uuid(op.delete.id) }).deleteOne();
      }
    }

    const res = await bulk.execute({});

    for (const op of operations) {
      if (op.insert) {
        this.postUpdate(asFull(op.insert));
      }
    }
    for (const [index, _id] of TypedObject.entries<Record<string, string>>(res.upsertedIds)) {
      out.insertedIds.set(+index, MongoUtil.idToString(_id));
    }

    if (out.counts) {
      out.counts.delete = res.deletedCount;
      out.counts.update = operations.filter(x => x.update).length;
      out.counts.insert = res.insertedCount;
      out.counts.upsert = operations.filter(x => x.upsert).length;
    }

    if (res.hasWriteErrors()) {
      out.errors = res.getWriteErrors();
      for (const err of out.errors) {
        const op = operations[err.index];
        const k = TypedObject.keys(op)[0];
        out.counts[k] -= 1;
      }
      out.counts.error = out.errors.length;
    }

    return out;
  }

  // Expiry
  deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return ModelQueryExpiryUtil.deleteExpired(this, cls);
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const store = await this.getStore(cls);
    const result = await store.findOne(
      this.getWhereFilter(
        cls,
        castTo(ModelIndexedUtil.projectIndex(cls, idx, body))
      )
    );
    if (!result) {
      throw new NotFoundError(`${cls.name}: ${idx}`, key);
    }
    return await ModelCrudUtil.load(cls, this.postLoad(result));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const store = await this.getStore(cls);
    const result = await store.deleteOne(
      this.getWhereFilter(
        cls,
        castTo(ModelIndexedUtil.projectIndex(cls, idx, body))
      )
    );
    if (result.deletedCount) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, key);
  }

  async upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    const store = await this.getStore(cls);
    const idxCfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);

    const where = this.getWhereFilter(
      cls,
      castTo(ModelIndexedUtil.projectIndex(cls, idx, body, { emptySortValue: { $exists: true } }))
    );

    const sort = castTo<{ [ListIndexⲐ]: PlainIdx }>(idxCfg)[ListIndexⲐ] ??= MongoUtil.getPlainIndex(idxCfg);
    const cursor = store.find(where, { timeout: true }).batchSize(100).sort(castTo(sort));

    for await (const el of cursor) {
      yield await ModelCrudUtil.load(cls, this.postLoad(el));
    }
  }

  // Query
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    const cursor = col.find(filter, {});
    const items = await MongoUtil.prepareCursor(cls, cursor, query).toArray();
    return await Promise.all(items.map(r => ModelCrudUtil.load(cls, this.postLoad(r))));
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    return col.countDocuments(filter);
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany = true): Promise<T> {
    const results = await this.query<T>(cls, { ...query, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts<T>(cls, failOnMany, results, query.where);
  }

  // Query Crud
  async updateByQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const item = await ModelCrudUtil.preStore(cls, data, this);
    const id = this.preUpdate(item);
    const where = ModelQueryUtil.getWhereClause(cls, query.where);
    where.id = id;

    const filter = MongoUtil.extractWhereFilter(cls, where);
    const res = await col.replaceOne(filter, item);
    if (res.matchedCount === 0) {
      throw new NotFoundError(cls, id);
    }
    return this.postUpdate(item);
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where, false);
    const res = await col.deleteMany(filter);
    return res.deletedCount ?? 0;
  }

  async updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const item = await ModelCrudUtil.prePartialUpdate(cls, data);
    delete item.id;

    const col = await this.getStore(cls);
    const items = MongoUtil.extractSimple(cls, item);
    const final = Object.entries(items).reduce<Partial<Record<'$unset' | '$set', Record<string, unknown>>>>(
      (acc, [k, v]) => {
        if (v === null || v === undefined) {
          (acc.$unset ??= {})[k] = v;
        } else {
          (acc.$set ??= {})[k] = v;
        }
        return acc;
      }, {});

    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    const res = await col.updateMany(filter, castTo(final));
    return res.matchedCount;
  }

  // Facet
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    if (query) {
      await QueryVerifier.verify(cls, query);
    }

    let q: Record<string, unknown> = { [field]: { $exists: true } };

    if (query?.where) {
      q = { $and: [q, MongoUtil.extractWhereFilter(cls, query.where)] };
    }

    const aggregations: object[] = [
      { $match: q },
      {
        $group: {
          _id: `$${field}`,
          count: {
            $sum: 1
          }
        }
      }
    ];

    const result = await col.aggregate<{ _id: ObjectId, count: number }>(aggregations).toArray();

    return result.map(val => ({
      key: MongoUtil.idToString(val._id),
      count: val.count
    })).sort((a, b) => b.count - a.count);
  }

  // Suggest
  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    await QueryVerifier.verify(cls, query);
    const q = ModelQuerySuggestUtil.getSuggestFieldQuery<T>(cls, field, prefix, query);
    const results = await this.query<T>(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults<T, string>(cls, field, prefix, results, (a) => a, query && query.limit);
  }

  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);
    const q = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const results = await this.query<T>(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, (_, b) => b, query && query.limit);
  }

  // Other
  async queryText<T extends ModelType>(cls: Class<T>, search: string | MongoTextSearch, query: PageableModelQuery<T> = {}): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    if (typeof search === 'string') {
      search = { $search: search, $language: 'en' };
    }

    (query.sort ??= []).unshift(castTo<(typeof query.sort[0])>({
      score: { $meta: 'textScore' }
    }));

    const cursor = col.find(castTo({ $and: [{ $text: search }, filter] }), {});
    const items = await MongoUtil.prepareCursor(cls, cursor, query).toArray();
    return await Promise.all(items.map(r => ModelCrudUtil.load(cls, this.postLoad(r))));
  }
}