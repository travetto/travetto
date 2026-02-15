import {
  type Binary,
  type Db, GridFSBucket, MongoClient, type GridFSFile, type Collection,
  type ObjectId, type RootFilterOperators, type Filter,
  type WithId as MongoWithId,
} from 'mongodb';

import {
  ModelRegistryIndex, type ModelType, type OptionalId, type ModelCrudSupport, type ModelStorageSupport,
  type ModelExpirySupport, type ModelBulkSupport, type ModelIndexedSupport, type BulkOperation, type BulkResponse,
  NotFoundError, ExistsError, type ModelBlobSupport,
  ModelCrudUtil, ModelIndexedUtil, ModelStorageUtil, ModelExpiryUtil, ModelBulkUtil
} from '@travetto/model';
import {
  type ModelQuery, type ModelQueryCrudSupport, type ModelQueryFacetSupport, type ModelQuerySupport,
  type PageableModelQuery, type ValidStringFields, type WhereClause, type ModelQuerySuggestSupport,
  QueryVerifier, ModelQueryUtil, ModelQuerySuggestUtil, ModelQueryCrudUtil,
  type ModelQueryFacet,
} from '@travetto/model-query';

import {
  ShutdownManager, type Class, type DeepPartial, TypedObject,
  castTo, asFull, type BinaryMetadata, type ByteRange, type BinaryType, BinaryUtil, BinaryMetadataUtil,
} from '@travetto/runtime';
import { Injectable } from '@travetto/di';

import { MongoUtil, type PlainIdx, type WithId } from './internal/util.ts';
import type { MongoModelConfig } from './config.ts';

const ListIndexSymbol = Symbol();

type BlobRaw = GridFSFile & { metadata?: BinaryMetadata };

type MongoTextSearch = RootFilterOperators<unknown>['$text'];

export const ModelBlobNamespace = '__blobs';

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

  #db: Db;
  #bucket: GridFSBucket;
  idSource = ModelCrudUtil.uuidSource();
  client: MongoClient;
  config: MongoModelConfig;

  constructor(config: MongoModelConfig) { this.config = config; }

  restoreId(item: { id?: string, _id?: unknown }): void {
    if (item._id) {
      item.id ??= MongoUtil.idToString(castTo(item._id));
      delete item._id;
    }
  }

  async postLoad<T extends ModelType>(cls: Class<T>, item: T | MongoWithId<T>): Promise<T> {
    this.restoreId(item);
    return await ModelCrudUtil.load(cls, item);
  }

  postUpdate<T extends ModelType>(item: T, id?: string): T {
    if (id) {
      item.id ??= id;
    }
    this.restoreId(item);
    return item;
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
    this.client = await MongoClient.connect(this.config.url, {
      ...this.config.connectionOptions,
      useBigInt64: true,
    });
    this.#db = this.client.db(this.config.namespace);
    this.#bucket = new GridFSBucket(this.#db, {
      bucketName: ModelBlobNamespace,
      writeConcern: { w: 1 }
    });
    await ModelStorageUtil.storageInitialization(this);
    ShutdownManager.signal.addEventListener('abort', () => this.client.close());
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

  async upsertModel(cls: Class): Promise<void> {
    const col = await this.getStore(cls);
    const indices = MongoUtil.getIndices(cls, ModelRegistryIndex.getConfig(cls).indices);
    const existingIndices = (await col.indexes().catch(() => [])).filter(idx => idx.name !== '_id_');

    const pendingMap = Object.fromEntries(indices.map(pair => [pair[1].name!, pair]));
    const existingMap = Object.fromEntries(existingIndices.map(idx => [idx.name!, idx.key]));

    for (const idx of existingIndices) {
      if (!idx.name) {
        continue;
      }
      const pending = pendingMap[idx.name];
      if (!pending) {
        console.debug('Deleting index', { indices: idx.name });
        await col.dropIndex(idx.name);
      } else if (MongoUtil.isIndexChanged(idx, pending)) {
        console.debug('Updating index', { indices: idx.name });
        await col.dropIndex(idx.name);
        await col.createIndex(...pending);
      }
    }
    for (const [name, idx] of Object.entries(pendingMap)) {
      if (!existingMap[name]) {
        console.debug('Creating index', { indices: name });
        await col.createIndex(...idx);
      }
    }
  }

  async truncateModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    const col = await this.getStore(cls);
    await col.deleteMany({});
  }

  async truncateBlob(): Promise<void> {
    await this.#bucket.drop().catch(() => { });
  }

  /**
   * Get mongo collection
   */
  async getStore<T extends ModelType>(cls: Class<T>): Promise<Collection<T>> {
    return this.#db.collection(ModelRegistryIndex.getStoreName(cls));
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const store = await this.getStore(cls);
    const result = await store.findOne(this.getIdFilter(cls, id), {});
    if (result) {
      const finalized = await this.postLoad(cls, result);
      if (finalized) {
        return finalized;
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
    return this.postUpdate(cleaned, id);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const id = this.preUpdate(item);
    const store = await this.getStore(cls);
    const result = await store.replaceOne(this.getIdFilter(cls, id), item);
    if (result.matchedCount === 0) {
      throw new NotFoundError(cls, id);
    }
    return this.postUpdate(item, id);
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
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key error')) {
        throw new ExistsError(cls, id);
      } else {
        throw error;
      }
    }
    return this.postUpdate(cleaned, id);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    const store = await this.getStore(cls);

    const final = await ModelCrudUtil.prePartialUpdate(cls, item, view);
    const simple = MongoUtil.extractSimple(cls, final, undefined, false);

    const operation: Partial<T> = castTo(Object
      .entries(simple)
      .reduce<Partial<Record<'$unset' | '$set', Record<string, unknown>>>>((document, [key, value]) => {
        if (value === null || value === undefined) {
          (document.$unset ??= {})[key] = value;
        } else {
          (document.$set ??= {})[key] = value;
        }
        return document;
      }, {}));

    const id = item.id;

    const result = await store.findOneAndUpdate(
      this.getIdFilter(cls, id),
      operation,
      { returnDocument: 'after', includeResultMetadata: true }
    );

    if (!result.value) {
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
    for await (const item of cursor) {
      try {
        yield await this.postLoad(cls, item);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
  }

  // Blob
  async upsertBlob(location: string, input: BinaryType, metadata?: BinaryMetadata, overwrite = true): Promise<void> {
    const existing = await this.getBlobMetadata(location).then(() => true, () => false);
    if (!overwrite && existing) {
      return;
    }
    const resolved = await BinaryMetadataUtil.compute(input, metadata);
    const writeStream = this.#bucket.openUploadStream(location, { metadata: resolved });
    await BinaryUtil.pipeline(input, writeStream);

    if (existing) {
      const [read] = await this.#bucket.find({ filename: location, _id: { $ne: writeStream.id } }).toArray();
      await this.#bucket.delete(read._id);
    }
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const metadata = await this.getBlobMetadata(location);
    const final = range ? BinaryMetadataUtil.enforceRange(range, metadata) : undefined;
    const mongoRange = final ? { start: final.start, end: final.end + 1 } : undefined;
    return BinaryMetadataUtil.makeBlob(() => this.#bucket.openDownloadStreamByName(location, mongoRange), { ...metadata, range: final });
  }

  async getBlobMetadata(location: string): Promise<BinaryMetadata> {
    const result = await this.#db.collection<{ metadata: BinaryMetadata }>(`${ModelBlobNamespace}.files`).findOne({ filename: location });
    return result!.metadata;
  }

  async deleteBlob(location: string): Promise<void> {
    const fileId = (await this.#describeBlobRaw(location))._id;
    await this.#bucket.delete(fileId);
  }

  async updateBlobMetadata(location: string, metadata: BinaryMetadata): Promise<void> {
    await this.#db.collection<{ metadata: BinaryMetadata }>(`${ModelBlobNamespace}.files`).findOneAndUpdate(
      { filename: location },
      { $set: { metadata, contentType: metadata.contentType! } },
    );
  }

  // Bulk
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse<{ index: number }>> {
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

    for (const operation of operations) {
      if (operation.insert) {
        this.preUpdate(operation.insert);
        bulk.insert(operation.insert);
      } else if (operation.upsert) {
        const id = this.preUpdate(operation.upsert);
        bulk.find({ _id: MongoUtil.uuid(id!) }).upsert().updateOne({ $set: operation.upsert });
      } else if (operation.update) {
        const id = this.preUpdate(operation.update);
        bulk.find({ _id: MongoUtil.uuid(id) }).update({ $set: operation.update });
      } else if (operation.delete) {
        bulk.find({ _id: MongoUtil.uuid(operation.delete.id) }).deleteOne();
      }
    }

    const result = await bulk.execute({});

    // Restore all ids
    for (const operation of operations) {
      const core = operation.insert ?? operation.upsert ?? operation.update;
      if (core) {
        this.postUpdate(asFull(core));
      }
    }

    for (const [index, _id] of TypedObject.entries<Record<string, string>>(result.upsertedIds)) {
      out.insertedIds.set(+index, MongoUtil.idToString(_id));
    }

    if (out.counts) {
      out.counts.delete = result.deletedCount;
      out.counts.update = operations.filter(item => item.update).length;
      out.counts.insert = result.insertedCount;
      out.counts.upsert = operations.filter(item => item.upsert).length;
    }

    if (result.hasWriteErrors()) {
      out.errors = result.getWriteErrors();
      for (const error of out.errors) {
        const operation = operations[error.index];
        const key = TypedObject.keys(operation)[0];
        out.counts[key] -= 1;
      }
      out.counts.error = out.errors.length;
    }

    return out;
  }

  // Expiry
  deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return ModelQueryCrudUtil.deleteExpired(this, cls);
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
    return await this.postLoad(cls, result);
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
    const idxConfig = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);

    const where = this.getWhereFilter(
      cls,
      castTo(ModelIndexedUtil.projectIndex(cls, idx, body, { emptySortValue: { $exists: true } }))
    );

    const sort = castTo<{ [ListIndexSymbol]: PlainIdx }>(idxConfig)[ListIndexSymbol] ??= MongoUtil.getPlainIndex(idxConfig);
    const cursor = store.find(where, { timeout: true }).batchSize(100).sort(castTo(sort));

    for await (const item of cursor) {
      yield await this.postLoad(cls, item);
    }
  }

  // Query
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    const cursor = col.find(filter, {});
    const items = await MongoUtil.prepareCursor(cls, cursor, query).toArray();
    return await Promise.all(items.map(item => this.postLoad(cls, item)));
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
    const result = await col.replaceOne(filter, item);
    if (result.matchedCount === 0) {
      throw new NotFoundError(cls, id);
    }
    return this.postUpdate(item, id);
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where, false);
    const result = await col.deleteMany(filter);
    return result.deletedCount ?? 0;
  }

  async updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const item = await ModelCrudUtil.prePartialUpdate(cls, data);
    const col = await this.getStore(cls);
    const items = MongoUtil.extractSimple(cls, item);
    const final = Object.entries(items).reduce<Partial<Record<'$unset' | '$set', Record<string, unknown>>>>(
      (document, [key, value]) => {
        if (value === null || value === undefined) {
          (document.$unset ??= {})[key] = value;
        } else {
          (document.$set ??= {})[key] = value;
        }
        return document;
      }, {});

    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    const result = await col.updateMany(filter, castTo(final));
    return result.matchedCount;
  }

  // Facet
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    if (query) {
      await QueryVerifier.verify(cls, query);
    }

    let queryObject: Record<string, unknown> = { [field]: { $exists: true } };

    if (query?.where) {
      queryObject = { $and: [queryObject, MongoUtil.extractWhereFilter(cls, query.where)] };
    }

    const aggregations: object[] = [
      { $match: queryObject },
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

    return result
      .map(item => ({
        key: MongoUtil.idToString(item._id),
        count: item.count
      }))
      .toSorted((a, b) => b.count - a.count);
  }

  // Suggest
  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    await QueryVerifier.verify(cls, query);
    const resolvedQuery = ModelQuerySuggestUtil.getSuggestFieldQuery<T>(cls, field, prefix, query);
    const results = await this.query<T>(cls, resolvedQuery);
    return ModelQuerySuggestUtil.combineSuggestResults<T, string>(cls, field, prefix, results, (a) => a, query && query.limit);
  }

  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);
    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const results = await this.query<T>(cls, resolvedQuery);
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
    return await Promise.all(items.map(item => this.postLoad(cls, item)));
  }
}