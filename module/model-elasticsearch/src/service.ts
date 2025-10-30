import { Client, errors, estypes } from '@elastic/elasticsearch';

import {
  ModelCrudSupport, BulkOp, BulkResponse, ModelBulkSupport, ModelExpirySupport,
  ModelIndexedSupport, ModelType, ModelStorageSupport, NotFoundError, ModelRegistryIndex, OptionalId,
  ModelCrudUtil, ModelIndexedUtil, ModelStorageUtil, ModelExpiryUtil, ModelBulkUtil,
} from '@travetto/model';
import { ShutdownManager, type DeepPartial, type Class, castTo, asFull, TypedObject, asConstructable } from '@travetto/runtime';
import { SchemaChange, BindUtil } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport,
  ModelQuerySupport, PageableModelQuery, Query, ValidStringFields,
  QueryVerifier, ModelQuerySuggestSupport,
  ModelQueryUtil, ModelQuerySuggestUtil, ModelQueryCrudUtil,
  ModelQueryFacet,
} from '@travetto/model-query';


import { ElasticsearchModelConfig } from './config.ts';
import { EsBulkError } from './internal/types.ts';
import { ElasticsearchQueryUtil } from './internal/query.ts';
import { ElasticsearchSchemaUtil } from './internal/schema.ts';
import { IndexManager } from './index-manager.ts';

/**
 * Elasticsearch model source.
 */
@Injectable()
export class ElasticsearchModelService implements
  ModelCrudSupport, ModelIndexedSupport,
  ModelStorageSupport, ModelBulkSupport,
  ModelExpirySupport,
  ModelQuerySupport, ModelQueryCrudSupport,
  ModelQuerySuggestSupport, ModelQueryFacetSupport {

  idSource = ModelCrudUtil.uuidSource();
  client: Client;
  manager: IndexManager;
  config: ElasticsearchModelConfig;

  constructor(config: ElasticsearchModelConfig) { this.config = config; }

  /**
   * Directly run the search
   */
  async execSearch<T extends ModelType>(cls: Class<T>, search: estypes.SearchRequest): Promise<estypes.SearchResponse<T>> {
    let query = search.query;
    if (query && Object.keys(query).length === 0) {
      query = undefined;
    }
    try {
      const result = await this.client.search<T>({
        ...this.manager.getIdentity(cls),
        ...search,
        query
      });
      return result;
    } catch (err) {
      if (err instanceof errors.ResponseError && err.meta.body && typeof err.meta.body === 'object' && 'error' in err.meta.body) {
        console.error(err.meta.body.error);
      }
      throw err;
    }
  }

  preUpdate(o: { id: string }): string;
  preUpdate(o: {}): undefined;
  preUpdate(o: { id?: string }): string | undefined {
    if ('id' in o && typeof o.id === 'string') {
      const id = o.id;
      if (!this.config.storeId) {
        delete o.id;
      }
      return id;
    }
    return;
  }

  postUpdate<T extends ModelType>(o: T, id?: string): T {
    if (!this.config.storeId) {
      o.id = id!;
    }
    return o;
  }

  /**
   * Convert _id to id
   */
  async postLoad<T extends ModelType>(cls: Class<T>, inp: estypes.SearchHit<T> | estypes.GetGetResult<T>): Promise<T> {
    let item = {
      ...(inp._id ? { id: inp._id } : {}),
      ...inp._source!,
    };

    item = await ModelCrudUtil.load(cls, item);

    const { expiresAt } = ModelRegistryIndex.getClassConfig(cls);

    if (expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, item);
      if (!expiry.expired) {
        return item;
      }
      throw new NotFoundError(cls, item.id);
    } else {
      return item;
    }
  }

  async postConstruct(this: ElasticsearchModelService): Promise<void> {
    this.client = new Client({
      nodes: this.config.hosts,
      ...(this.config.options || {}),
    });
    await this.client.cluster.health({});
    this.manager = new IndexManager(this.config, this.client);

    await ModelStorageUtil.registerModelChangeListener(this.manager);
    ShutdownManager.onGracefulShutdown(() => this.client.close());
    ModelExpiryUtil.registerCull(this);
  }

  createStorage(): Promise<void> { return this.manager.createStorage(); }
  deleteStorage(): Promise<void> { return this.manager.deleteStorage(); }
  createModel(cls: Class): Promise<void> { return this.manager.createModel(cls); }
  exportModel(cls: Class): Promise<string> { return this.manager.exportModel(cls); }
  deleteModel(cls: Class): Promise<void> { return this.manager.deleteModel(cls); }
  changeSchema(cls: Class, change: SchemaChange): Promise<void> { return this.manager.changeSchema(cls, change); }
  truncateModel(cls: Class): Promise<void> { return this.deleteByQuery(cls, {}).then(() => { }); }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    try {
      const result = await this.client.get<T>({ ...this.manager.getIdentity(cls), id });
      return this.postLoad(cls, result);
    } catch {
      throw new NotFoundError(cls, id);
    }
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);

    try {
      const result = await this.client.delete({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
      });
      if (result.result === 'not_found') {
        throw new NotFoundError(cls, id);
      }
    } catch (err) {
      if (err && err instanceof errors.ResponseError && err.body && err.body.result === 'not_found') {
        throw new NotFoundError(cls, id);
      }
      throw err;
    }
  }

  async create<T extends ModelType>(cls: Class<T>, o: OptionalId<T>): Promise<T> {
    try {
      const clean = await ModelCrudUtil.preStore(cls, o, this);
      const id = this.preUpdate(clean);

      await this.client.index({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
        body: castTo<T & { id: never }>(clean)
      });

      return this.postUpdate(clean, id);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async update<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = this.preUpdate(o);

    if (ModelRegistryIndex.getClassConfig(cls).expiresAt) {
      await this.get(cls, id);
    }

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      op_type: 'index',
      refresh: true,
      body: castTo<T & { id: never }>(o)
    });

    return this.postUpdate(o, id);
  }

  async upsert<T extends ModelType>(cls: Class<T>, o: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const item = await ModelCrudUtil.preStore(cls, o, this);
    const id = this.preUpdate(item);

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: true,
      doc: item,
      doc_as_upsert: true
    });

    return this.postUpdate(item, id);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, data: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const id = data.id;
    const item = castTo<typeof data>(await ModelCrudUtil.prePartialUpdate(cls, data, view));
    const script = ElasticsearchSchemaUtil.generateUpdateScript(item);

    try {
      await this.client.update({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
        script,
      });
    } catch (err) {
      if (err instanceof Error && /document_missing_exception/.test(err.message)) {
        throw new NotFoundError(cls, id);
      }
      throw err;
    }

    return this.get(cls, id);
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    let search: estypes.SearchResponse<T> = await this.execSearch<T>(cls, {
      scroll: '2m',
      size: 100,
      query: ElasticsearchQueryUtil.getSearchQuery(cls, {})
    });

    while (search.hits.hits.length > 0) {
      for (const el of search.hits.hits) {
        try {
          yield this.postLoad(cls, el);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
        search = await this.client.scroll({
          scroll_id: search._scroll_id,
          scroll: '2m'
        });
      }
    }
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse<EsBulkError>> {

    await ModelBulkUtil.preStore(cls, operations, this);

    const body = operations.reduce<(T | Partial<Record<'delete' | 'create' | 'index' | 'update', { _index: string, _id?: string }>> | { doc: T })[]>((acc, op) => {

      const esIdent = this.manager.getIdentity(asConstructable<T>((op.upsert ?? op.delete ?? op.insert ?? op.update ?? { constructor: cls })).constructor);
      const ident: { _index: string, _type?: unknown } = { _index: esIdent.index };

      if (op.delete) {
        acc.push({ delete: { ...ident, _id: op.delete.id } });
      } else if (op.insert) {
        const id = this.preUpdate(op.insert);
        acc.push({ create: { ...ident, _id: id } }, castTo(op.insert));
      } else if (op.upsert) {
        const id = this.preUpdate(op.upsert);
        acc.push({ index: { ...ident, _id: id } }, castTo(op.upsert));
      } else if (op.update) {
        const id = this.preUpdate(op.update);
        acc.push({ update: { ...ident, _id: id } }, { doc: op.update });
      }
      return acc;
    }, []);

    const result = await this.client.bulk({
      operations: body,
      refresh: true
    });

    const out: BulkResponse<EsBulkError> = {
      counts: {
        delete: 0,
        insert: 0,
        upsert: 0,
        update: 0,
        error: 0
      },
      insertedIds: new Map(),
      errors: []
    };

    type Count = keyof typeof out['counts'];

    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      const [k] = TypedObject.keys(item);
      const v = item[k]!;
      if (v.error) {
        out.errors.push({
          reason: v.error!.reason!,
          type: v.error!.type
        });
        out.counts.error += 1;
      } else {
        let sk: Count;
        switch (k) {
          case 'create': sk = 'insert'; break;
          case 'index': sk = operations[i].insert ? 'insert' : 'upsert'; break;
          case 'delete': case 'update': sk = k; break;
          default: {
            throw new Error(`Unknown response key: ${k}`);
          }
        }

        if (v.result === 'created') {
          out.insertedIds.set(i, v._id!);
          (operations[i].insert ?? operations[i].upsert)!.id = v._id!;
        }

        out.counts[sk] += 1;
      }
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
    const result = await this.execSearch<T>(cls, {
      query: ElasticsearchQueryUtil.getSearchQuery(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body))
      )
    });
    if (!result.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx}`, key);
    }
    return this.postLoad(cls, result.hits.hits[0]);
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const result = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      query: ElasticsearchQueryUtil.getSearchQuery(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body))
      ),
      refresh: true
    });
    if (result.deleted) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, key);
  }

  async upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    const cfg = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);
    let search = await this.execSearch<T>(cls, {
      scroll: '2m',
      size: 100,
      query: ElasticsearchQueryUtil.getSearchQuery(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body, { emptySortValue: { $exists: true } }))
      ),
      sort: ElasticsearchQueryUtil.getSort(cfg.fields)
    });

    while (search.hits.hits.length > 0) {
      for (const el of search.hits.hits) {
        try {
          yield this.postLoad(cls, el);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
        search = await this.client.scroll({
          scroll_id: search._scroll_id,
          scroll: '2m'
        });
      }
    }
  }

  // Query
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const req = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const results = await this.execSearch(cls, req);
    const shouldRemoveIds = query.select && 'id' in query.select && !query.select.id;
    return Promise.all(results.hits.hits.map(m => this.postLoad(cls, m).then(v => {
      if (shouldRemoveIds) {
        delete castTo<OptionalId<T>>(v).id;
      }
      return v;
    })));
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany: boolean = true): Promise<T> {
    const result = await this.query<T>(cls, { ...query, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts<T>(cls, failOnMany, result, query.where);
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const req = ElasticsearchQueryUtil.getSearchObject(cls, { ...query, limit: 0 }, this.config.schemaConfig);
    const result: number | { value: number } = (await this.execSearch(cls, req)).hits.total || { value: 0 };
    return typeof result !== 'number' ? result.value : result;
  }

  // Query Crud
  async updateByQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    await QueryVerifier.verify(cls, query);

    const item = await ModelCrudUtil.preStore(cls, data, this);
    const id = this.preUpdate(item);

    const where = ModelQueryUtil.getWhereClause(cls, query.where);
    if (id) {
      where.id = id;
    }
    query.where = where;

    if (ModelRegistryIndex.getClassConfig(cls).expiresAt) {
      await this.get(cls, id);
    }

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);

    const copy = BindUtil.bindSchemaToObject(cls, asFull<T>({}), item);

    try {
      const result = await this.client.updateByQuery({
        ...this.manager.getIdentity(cls),
        refresh: true,
        query: search.query,
        max_docs: 1,
        script: ElasticsearchSchemaUtil.generateReplaceScript(castTo(copy))
      });

      if (result.version_conflicts || result.updated === undefined || result.updated === 0) {
        throw new NotFoundError(cls, id);
      }
    } catch (err) {
      if (err instanceof errors.ResponseError && 'version_conflicts' in err.body) {
        throw new NotFoundError(cls, id);
      } else {
        throw err;
      }
    }

    return this.postUpdate(item, id);
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const { sort: _, ...q } = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, false);
    const result = await this.client.deleteByQuery({
      ...this.manager.getIdentity(cls),
      ...q,
      refresh: true,
    });
    return result.deleted ?? 0;
  }

  async updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const item = await ModelCrudUtil.prePartialUpdate(cls, data);
    const script = ElasticsearchSchemaUtil.generateUpdateScript(item);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const result = await this.client.updateByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      query: search.query,
      script,
    });

    return result.updated ?? 0;
  }

  // Query Facet
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const q = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const search = ElasticsearchQueryUtil.getSearchObject(cls, q);
    const result = await this.execSearch(cls, search);
    const all = await Promise.all(result.hits.hits.map(x => this.postLoad(cls, x)));
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, all, (x, v) => v, query && query.limit);
  }

  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    await QueryVerifier.verify(cls, query);

    const q = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, {
      select: castTo({ [field]: 1 }),
      ...query
    });
    const search = ElasticsearchQueryUtil.getSearchObject(cls, q);
    const result = await this.execSearch(cls, search);
    const all = await Promise.all(result.hits.hits.map(x => castTo<T>(({ [field]: field === 'id' ? x._id : x._source![field] }))));
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, all, x => x, query && query.limit);
  }

  // Facet
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(cls, query);

    const q = ElasticsearchQueryUtil.getSearchObject(cls, query ?? {}, this.config.schemaConfig);

    const search: estypes.SearchRequest = {
      query: q.query ?? { ['match_all']: {} },
      aggs: { [field]: { terms: { field, size: 100 } } },
      size: 0
    };

    const result = await this.execSearch(cls, search);
    const { buckets } = castTo<estypes.AggregationsStringTermsAggregate>('buckets' in result.aggregations![field] ? result.aggregations![field] : { buckets: [] });
    const out = Array.isArray(buckets) ? buckets.map(b => ({ key: b.key!.toString(), count: b.doc_count })) : [];
    return out;
  }
}