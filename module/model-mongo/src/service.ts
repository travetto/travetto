import {
  type Db, GridFSBucket, MongoClient, type Sort, type CreateIndexesOptions,
  type GridFSFile, type IndexSpecification, type Collection, ObjectId,
  Binary
} from 'mongodb';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import {
  ModelRegistry, ModelType, OptionalId, ModelCrudSupport, ModelStorageSupport,
  ModelExpirySupport, ModelBulkSupport, ModelIndexedSupport, BulkOp, BulkResponse,
  NotFoundError, ExistsError, IndexConfig, ModelBlobSupport, ModelBlobNamespace,
  ModelBlobUtil
} from '@travetto/model';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySupport,
  PageableModelQuery, ValidStringFields, WhereClause, ModelQuerySuggestSupport,
  QueryVerifier
} from '@travetto/model-query';

import {
  ShutdownManager, type Class, type DeepPartial, AppError, TypedObject,
  castTo, asFull, BlobMeta, ByteRange, BinaryInput, BinaryUtil
} from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { FieldConfig, SchemaRegistry, SchemaValidator } from '@travetto/schema';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { PointImpl } from '@travetto/model-query/src/internal/model/point';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';
import { ModelBulkUtil } from '@travetto/model/src/internal/service/bulk';

import { MongoUtil, WithId } from './internal/util';
import { MongoModelConfig } from './config';

const IdxFieldsⲐ = Symbol.for('@travetto/model-mongo:idx');

const asFielded = (cfg: IndexConfig<ModelType>): { [IdxFieldsⲐ]: Sort } => castTo(cfg);

type IdxCfg = CreateIndexesOptions;

type BlobRaw = GridFSFile & { metadata?: BlobMeta };

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

  getWhereFilter<T extends ModelType>(cls: Class<T>, where: WhereClause<T>, checkExpiry = true): Record<string, unknown> {
    return MongoUtil.extractWhereFilter(cls, where, checkExpiry);
  }

  // Storage
  async createStorage(): Promise<void> { }

  async deleteStorage(): Promise<void> {
    await this.#db.dropDatabase();
  }

  getGeoIndices<T extends ModelType>(cls: Class<T>, path: FieldConfig[] = [], root = cls): IndexSpecification[] {
    const fields = SchemaRegistry.has(cls) ?
      Object.values(SchemaRegistry.get(cls).views[AllViewⲐ].schema) :
      [];
    const out: IndexSpecification[] = [];
    for (const field of fields) {
      if (SchemaRegistry.has(field.type)) {
        // Recurse
        out.push(...this.getGeoIndices(field.type, [...path, field], root));
      } else if (field.type === PointImpl) {
        const name = [...path, field].map(x => x.name).join('.');
        console.debug('Preparing geo-index', { cls: root.Ⲑid, name });
        out.push({ [name]: '2d' });
      }
    }
    return out;
  }

  getIndices<T extends ModelType>(cls: Class<T>): ([IndexSpecification] | [IndexSpecification, IdxCfg])[] {
    const indices = ModelRegistry.get(cls).indices ?? [];
    return [
      ...indices.map((idx): [IndexSpecification, IdxCfg] => {
        const combined = asFielded(idx)[IdxFieldsⲐ] ??= Object.assign({}, ...idx.fields.map(x => MongoUtil.toIndex(x)));
        return [
          castTo(combined),
          (idx.type === 'unique' ? { unique: true } : {})
        ];
      }),
      ...this.getGeoIndices(cls).map((x): [IndexSpecification] => [x])
    ];
  }

  async establishIndices<T extends ModelType>(cls: Class<T>): Promise<void> {
    const col = await this.getStore(cls);
    const creating = this.getIndices(cls);
    if (creating.length) {
      console.debug('Creating indexes', { indices: creating });
      for (const el of creating) {
        await col.createIndex(el[0], el[1] ?? {});
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
    const col = await this.getStore(cls);
    await col.deleteMany({});
  }

  async truncateFinalize(): Promise<void> {
    try {
      await this.#bucket.drop();
    } catch { }
  }

  /**
   * Get mongo collection
   */
  async getStore<T extends ModelType>(cls: Class<T>): Promise<Collection> {
    return this.#db.collection(ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_'));
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const store = await this.getStore(cls);
    const result = await store.findOne(this.getWhereFilter<ModelType>(cls, { id }), {});
    if (result) {
      const res = await ModelCrudUtil.load(cls, result);
      if (res) {
        return MongoUtil.postLoadId(res);
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const cleaned: WithId<T, Binary> = castTo(await ModelCrudUtil.preStore(cls, item, this));
    cleaned._id = MongoUtil.uuid(cleaned.id);

    const store = await this.getStore(cls);
    const result = await store.insertOne(castTo(cleaned));
    if (!result.insertedId) {
      throw new ExistsError(cls, cleaned.id);
    }
    delete cleaned._id;
    return cleaned;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const store = await this.getStore(cls);
    const res = await store.replaceOne(this.getWhereFilter<ModelType>(cls, { id: item.id }), item);
    if (res.matchedCount === 0) {
      throw new NotFoundError(cls, item.id);
    }
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const cleaned = await ModelCrudUtil.preStore(cls, item, this);
    const store = await this.getStore(cls);
    try {
      await store.updateOne(
        this.getWhereFilter<ModelType>(cls, { id: cleaned.id }, false),
        { $set: cleaned },
        { upsert: true }
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('duplicate key error')) {
        throw new ExistsError(cls, cleaned.id);
      } else {
        throw err;
      }
    }
    return cleaned;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    const store = await this.getStore(cls);

    if (view) {
      await SchemaValidator.validate(cls, item, view);
    }

    item = await ModelCrudUtil.prePersist(cls, item, 'partial');

    let final: Record<string, unknown> = item;

    const items = MongoUtil.extractSimple(cls, final, undefined, false);
    final = Object
      .entries(items)
      .reduce<Partial<Record<'$unset' | '$set', Record<string, unknown>>>>((acc, [k, v]) => {
        if (v === null || v === undefined) {
          (acc.$unset ??= {})[k] = v;
        } else {
          (acc.$set ??= {})[k] = v;
        }
        return acc;
      }, {});

    const id = item.id;

    const res = await store.findOneAndUpdate(
      this.getWhereFilter<ModelType>(cls, { id }),
      final,
      { returnDocument: 'after', includeResultMetadata: true }
    );

    if (!res.value) {
      throw new NotFoundError(cls, id);
    }

    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    const store = await this.getStore(cls);
    const result = await store.deleteOne(this.getWhereFilter<ModelType>(cls, { id }, false));
    if (result.deletedCount === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    const store = await this.getStore(cls);
    const cursor = store.find(this.getWhereFilter(cls, {}), { timeout: true }).batchSize(100);
    for await (const el of cursor) {
      try {
        yield MongoUtil.postLoadId(await ModelCrudUtil.load(cls, el));
      } catch (err) {
        if (!(err instanceof NotFoundError)) {
          throw err;
        }
      }
    }
  }

  // Blob
  async insertBlob(location: string, input: BinaryInput, meta?: BlobMeta, errorIfExisting = false): Promise<void> {
    await this.describeBlob(location);
    if (errorIfExisting) {
      throw new ExistsError(ModelBlobNamespace, location);
    }
    return this.upsertBlob(location, input, meta);
  }

  async upsertBlob(location: string, input: BinaryInput, meta?: BlobMeta): Promise<void> {
    const [stream, blobMeta] = await ModelBlobUtil.getInput(input, meta);
    const writeStream = this.#bucket.openUploadStream(location, {
      contentType: blobMeta.contentType,
      metadata: blobMeta
    });

    await pipeline(stream, writeStream);
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const meta = await this.describeBlob(location);
    const final = range ? ModelBlobUtil.enforceRange(range, meta.size!) : undefined;
    const mongoRange = final ? { start: final.start, end: final.end + 1 } : undefined;
    const res = (): Readable => this.#bucket.openDownloadStreamByName(location, mongoRange);
    return BinaryUtil.readableBlob(res, { ...meta, range: final });
  }

  async describeBlob(location: string): Promise<BlobMeta> {
    return (await this.#describeBlobRaw(location)).metadata ?? {};
  }

  async deleteBlob(location: string): Promise<void> {
    const fileId = (await this.#describeBlobRaw(location))._id;
    await this.#bucket.delete(fileId);
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

    const store = await this.getStore(cls);
    const bulk = store.initializeUnorderedBulkOp({ writeConcern: { w: 1 } });
    const { upsertedIds, insertedIds } = await ModelBulkUtil.preStore(cls, operations, this);

    out.insertedIds = new Map([...upsertedIds.entries(), ...insertedIds.entries()]);

    for (const op of operations) {
      if (op.insert) {
        bulk.insert(MongoUtil.preInsertId(asFull(op.insert)));
      } else if (op.upsert) {
        bulk.find({ _id: MongoUtil.uuid(op.upsert.id!) }).upsert().updateOne({ $set: op.upsert });
      } else if (op.update) {
        bulk.find({ _id: MongoUtil.uuid(op.update.id) }).update({ $set: op.update });
      } else if (op.delete) {
        bulk.find({ _id: MongoUtil.uuid(op.delete.id) }).deleteOne();
      }
    }

    const res = await bulk.execute({});

    for (const op of operations) {
      if (op.insert) {
        MongoUtil.postLoadId(asFull(op.insert));
      }
    }
    for (const [index, _id] of TypedObject.entries(res.upsertedIds)) {
      out.insertedIds.set(+index, MongoUtil.idToString(castTo(_id)));
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
    return await ModelCrudUtil.load(cls, result);
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
    const idxCfg = ModelRegistry.getIndex(cls, idx);

    if (idxCfg.type === 'unique') {
      throw new AppError('Cannot list on unique indices', 'data');
    }

    const where = this.getWhereFilter(
      cls,
      castTo(ModelIndexedUtil.projectIndex(cls, idx, body, { emptySortValue: { $exists: true } }))
    );

    const cursor = store.find(where, { timeout: true }).batchSize(100).sort(asFielded(idxCfg)[IdxFieldsⲐ]);

    for await (const el of cursor) {
      yield (await MongoUtil.postLoadId(await ModelCrudUtil.load(cls, el)));
    }
  }

  // Query
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    let cursor = col.find<T>(filter, {});
    if (query.select) {
      const selectKey = Object.keys(query.select)[0];
      const select = typeof selectKey === 'string' && selectKey.startsWith('$') ? query.select : MongoUtil.extractSimple(cls, query.select);
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
      cursor = cursor.sort(Object.assign({}, ...query.sort.map(x => MongoUtil.extractSimple(cls, x))));
    }

    cursor = cursor.limit(Math.trunc(query.limit ?? 200));

    if (query.offset && typeof query.offset === 'number') {
      cursor = cursor.skip(Math.trunc(query.offset ?? 0));
    }

    const items = await cursor.toArray();
    return await Promise.all(items.map(r => ModelCrudUtil.load(cls, r).then(MongoUtil.postLoadId)));
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where);
    return col.countDocuments(filter);
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany = false): Promise<T> {
    const results = await this.query<T>(cls, { ...query, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts<T>(cls, results, failOnMany);
  }

  // Query Crud
  async updateOneWithQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const item = await ModelCrudUtil.preStore(cls, data, this);
    const where = ModelQueryUtil.getWhereClause(cls, query.where);
    where.id = item.id;

    const filter = MongoUtil.extractWhereFilter(cls, where);
    const res = await col.replaceOne(filter, item);
    if (res.matchedCount === 0) {
      throw new NotFoundError(cls, item.id);
    }
    return item;
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const filter = MongoUtil.extractWhereFilter(cls, query.where, false);
    const res = await col.deleteMany(filter);
    return res.deletedCount ?? 0;
  }

  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const col = await this.getStore(cls);
    const items = MongoUtil.extractSimple(cls, data);
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
    const res = await col.updateMany(filter, final);
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
}