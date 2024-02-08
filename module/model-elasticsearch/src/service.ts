import { Client, errors } from '@elastic/elasticsearch';
import {
  AggregationsStringTermsAggregate, AggregationsStringTermsBucket, DeleteByQueryRequest, SearchRequest, SearchResponse, UpdateByQueryResponse
} from '@elastic/elasticsearch/lib/api/types';

import {
  ModelCrudSupport, BulkOp, BulkResponse, ModelBulkSupport, ModelExpirySupport,
  ModelIndexedSupport, ModelType, ModelStorageSupport, NotFoundError, ModelRegistry,
  OptionalId
} from '@travetto/model';
import { ShutdownManager, type Class, AppError } from '@travetto/base';
import { SchemaChange, DeepPartial, BindUtil } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport,
  ModelQuerySupport, PageableModelQuery, Query, SelectClause, ValidStringFields
} from '@travetto/model-query';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelQuerySuggestSupport } from '@travetto/model-query/src/service/suggest';
import { ModelBulkUtil } from '@travetto/model/src/internal/service/bulk';

import { ElasticsearchModelConfig } from './config';
import { EsBulkError } from './internal/types';
import { ElasticsearchQueryUtil } from './internal/query';
import { ElasticsearchSchemaUtil } from './internal/schema';
import { IndexManager } from './index-manager';

type WithId<T> = T & { _id?: string };

const isWithId = <T extends ModelType>(o: T): o is WithId<T> => !o && '_id' in o;

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

  constructor(public readonly config: ElasticsearchModelConfig) { }

  /**
   * Directly run the search
   */
  async execSearch<T extends ModelType>(cls: Class<T>, search: SearchRequest): Promise<SearchResponse<T>> {
    let query = search.query;
    if (query && Object.keys(query).length === 0) {
      query = undefined;
    }
    try {
      const res = await this.client.search<T>({
        ...this.manager.getIdentity(cls),
        ...search,
        query
      });
      return res;
    } catch (err) {
      if (err instanceof errors.ResponseError && err.meta.body && typeof err.meta.body === 'object' && 'error' in err.meta.body) {
        console.error(err.meta.body.error);
      }
      throw err;
    }
  }

  /**
   * Convert _id to id
   */
  async postLoad<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    if (isWithId(item)) {
      delete item._id;
    }

    item = await ModelCrudUtil.load(cls, item);

    const { expiresAt } = ModelRegistry.get(cls);

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

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await ModelStorageUtil.registerModelChangeListener(this.manager, this.constructor as Class);
    ShutdownManager.onGracefulShutdown(() => this.client.close(), this);
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
      const res = await this.client.get({ ...this.manager.getIdentity(cls), id });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return this.postLoad(cls, res._source as T);
    } catch {
      throw new NotFoundError(cls, id);
    }
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);

    try {
      const res = await this.client.delete({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
      });
      if (res.result === 'not_found') {
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
      const id = clean.id;

      await this.client.index({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
        body: clean
      });

      return clean;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async update<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = o.id;

    if (ModelRegistry.get(cls).expiresAt) {
      await this.get(cls, id);
    }

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      op_type: 'index',
      refresh: true,
      body: o
    });

    o.id = id;
    return o;
  }

  async upsert<T extends ModelType>(cls: Class<T>, o: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const item = await ModelCrudUtil.preStore(cls, o, this);

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id: item.id,
      refresh: true,
      body: {
        doc: item,
        doc_as_upsert: true
      }
    });

    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);
    const id = data.id;

    console.debug('Partial Script', { script });

    try {
      await this.client.update({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
        body: {
          script
        }
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
    let search: SearchResponse<T> = await this.execSearch<T>(cls, {
      scroll: '2m',
      size: 100,
      query: ElasticsearchQueryUtil.getSearchQuery(cls, {})
    });

    while (search.hits.hits.length > 0) {
      for (const el of search.hits.hits) {
        try {
          yield this.postLoad(cls, el._source!);
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

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const esIdent = this.manager.getIdentity((op.upsert ?? op.delete ?? op.insert ?? op.update ?? { constructor: cls }).constructor as Class);
      const ident: { _index: string, _type?: unknown } = { _index: esIdent.index };

      if (op.delete) {
        acc.push({ delete: { ...ident, _id: op.delete.id } });
      } else if (op.insert) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        acc.push({ create: { ...ident, _id: op.insert.id } }, op.insert as T);
      } else if (op.upsert) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        acc.push({ index: { ...ident, _id: op.upsert.id } }, op.upsert as T);
      } else if (op.update) {
        acc.push({ update: { ...ident, _id: op.update.id } }, { doc: op.update });
      }
      return acc;
    }, []);

    const res = await this.client.bulk({
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

    for (let i = 0; i < res.items.length; i++) {
      const item = res.items[i];
      const [k] = Object.keys(item);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const v = item[k as keyof typeof item]!;
      if (k === 'error') {
        out.errors.push({
          reason: v.error!.reason!,
          type: v.error!.type
        });
        out.counts.error += 1;
      } else {
        let sk: Count;
        if (k === 'create') {
          sk = 'insert';
        } else if (k === 'index') {
          sk = operations[i].insert ? 'insert' : 'upsert';
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          sk = k as Count;
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
    return ModelQueryExpiryUtil.deleteExpired(this, cls);
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const res: SearchResponse<T> = await this.execSearch<T>(cls, {
      query: ElasticsearchQueryUtil.getSearchQuery(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body))
      )
    });
    if (!res.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx}`, key);
    }
    return this.postLoad(cls, res.hits.hits[0]._source!);
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const res = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      query: ElasticsearchQueryUtil.getSearchQuery(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body))
      ),
      refresh: true
    });
    if (res.deleted) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, key);
  }

  async upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    const cfg = ModelRegistry.getIndex(cls, idx);
    if (cfg.type === 'unique') {
      throw new AppError('Cannot list on unique indices', 'data');
    }
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
          yield this.postLoad(cls, el._source!);
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
    const req = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const results = await this.execSearch(cls, req);
    const items = ElasticsearchQueryUtil.cleanIdRemoval(req, results);
    return Promise.all(items.map(m => this.postLoad(cls, m)));
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean): Promise<T> {
    return ModelQueryUtil.verifyGetSingleCounts(cls, await this.query<T>(cls, { ...query, limit: failOnMany ? 2 : 1 }));
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    const req = ElasticsearchQueryUtil.getSearchObject(cls, { ...query, limit: 0 }, this.config.schemaConfig);
    const res: number | { value: number } = (await this.execSearch(cls, req)).hits.total || { value: 0 };
    return typeof res !== 'number' ? res.value : res;
  }

  // Query Crud
  async updateOneWithQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const item = await ModelCrudUtil.preStore(cls, data, this);
    const id = item.id;

    query = ModelQueryUtil.getQueryWithId(cls, data, query);

    if (ModelRegistry.get(cls).expiresAt) {
      await this.get(cls, id);
    }

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const copy = BindUtil.bindSchemaToObject(cls, {} as T, item);

    try {
      const res = await this.client.updateByQuery({
        ...this.manager.getIdentity(cls),
        refresh: true,
        query: search.query,
        max_docs: 1,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        script: ElasticsearchSchemaUtil.generateReplaceScript(copy as {})
      });

      if (res.version_conflicts || res.updated === undefined || res.updated === 0) {
        throw new NotFoundError(cls, id);
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (err instanceof errors.ResponseError && (err.body as UpdateByQueryResponse).version_conflicts) {
        throw new NotFoundError(cls, id);
      } else {
        throw err;
      }
    }

    return item;
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const res = await this.client.deleteByQuery({
      ...this.manager.getIdentity(cls),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ...ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, false) as DeleteByQueryRequest,
      refresh: true,
    });
    return res.deleted ?? 0;
  }

  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {

    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const res = await this.client.updateByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      query: search.query,
      script,
    });

    return res.updated ?? 0;
  }

  // Query Facet
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const q = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const search = ElasticsearchQueryUtil.getSearchObject(cls, q);
    const res = await this.execSearch(cls, search);
    const safe = ElasticsearchQueryUtil.cleanIdRemoval<T>(search, res);
    const combined = ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, safe, (x, v) => v, query && query.limit);
    return Promise.all(combined.map(m => this.postLoad(cls, m)));
  }

  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const select: SelectClause<T> = { [field]: 1 } as SelectClause<T>;

    const q = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, {
      select,
      ...query
    });
    const search = ElasticsearchQueryUtil.getSearchObject(cls, q);
    const res = await this.execSearch(cls, search);
    const safe = ElasticsearchQueryUtil.cleanIdRemoval(search, res);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, safe, x => x, query && query.limit);
  }

  // Facet
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const q = ElasticsearchQueryUtil.getSearchObject(cls, query ?? {}, this.config.schemaConfig);

    const search = {
      body: {
        query: q.query ?? { ['match_all']: {} },
        aggs: { [field]: { terms: { field, size: 100 } } }
      },
      size: 0
    };

    const res = await this.execSearch(cls, search);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { buckets } = res.aggregations![field] as AggregationsStringTermsAggregate;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const out = (buckets as AggregationsStringTermsBucket[]).map(b => ({ key: b.key, count: b.doc_count }));
    return out;
  }
}