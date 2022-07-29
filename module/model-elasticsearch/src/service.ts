import * as es from '@elastic/elasticsearch';
import { Search } from '@elastic/elasticsearch/api/requestParams';

import {
  ModelCrudSupport, BulkOp, BulkResponse, ModelBulkSupport, ModelExpirySupport,
  ModelIndexedSupport, ModelType, ModelStorageSupport, NotFoundError, ModelRegistry,
  OptionalId
} from '@travetto/model';
import { Class, Util, ShutdownManager, AppError } from '@travetto/base';
import { SchemaChange, DeepPartial } from '@travetto/schema';
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
import { SearchResponse } from './types';

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

  client: es.Client;
  manager: IndexManager;

  constructor(public readonly config: ElasticsearchModelConfig) { }

  /**
   * Directly run the search
   */
  async execSearch<T extends ModelType>(cls: Class<T>, search: Search<unknown>): Promise<SearchResponse<T>> {
    const res = await this.client.search({
      ...this.manager.getIdentity(cls),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ...search as Search<T>
    });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return res as unknown as SearchResponse<T>;
  }

  /**
   * Convert _id to id
   */
  async postLoad<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    if (isWithId(o)) {
      o.id = o._id!;
      delete o._id;
    }

    o = await ModelCrudUtil.load(cls, o);

    const { expiresAt } = ModelRegistry.get(cls);

    if (expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, o);
      if (!expiry.expired) {
        return o;
      }
      throw new NotFoundError(cls, o.id);
    } else {
      return o;
    }
  }

  async postConstruct(this: ElasticsearchModelService): Promise<void> {
    this.client = new es.Client({
      nodes: this.config.hosts,
      ...(this.config.options || {})
    });
    await this.client.cluster.health({});
    this.manager = new IndexManager(this.config, this.client);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await ModelStorageUtil.registerModelChangeListener(this.manager, this.constructor as Class);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.close());
    ModelExpiryUtil.registerCull(this);
  }

  createStorage(): Promise<void> { return this.manager.createStorage(); }
  deleteStorage(): Promise<void> { return this.manager.deleteStorage(); }
  createModel(cls: Class): Promise<void> { return this.manager.createModel(cls); }
  exportModel(cls: Class): Promise<string> { return this.manager.exportModel(cls); }
  deleteModel(cls: Class): Promise<void> { return this.manager.deleteModel(cls); }
  changeSchema(cls: Class, change: SchemaChange): Promise<void> { return this.manager.changeSchema(cls, change); }
  truncateModel(cls: Class): Promise<void> { return this.deleteByQuery(cls, {}).then(() => { }); }

  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    try {
      const res = await this.client.get({ ...this.manager.getIdentity(cls), id });
      return this.postLoad(cls, res.body._source);
    } catch {
      throw new NotFoundError(cls, id);
    }
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);

    try {
      const { body: res } = await this.client.delete({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true
      });
      if (res.result === 'not_found') {
        throw new NotFoundError(cls, id);
      }
    } catch (err) {
      if (err && err instanceof es.errors.ResponseError && err.body && err.body.result === 'not_found') {
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

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: true,
      body: {
        script
      }
    });

    return this.get(cls, id);
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    let search: SearchResponse<T> = await this.execSearch(cls, {
      scroll: '2m',
      size: 100,
      body: ElasticsearchQueryUtil.getSearchBody(cls, {})
    });

    while (search.body.hits.hits.length > 0) {
      for (const el of search.body.hits.hits) {
        try {
          yield this.postLoad(cls, el._source);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
        search = await this.client.scroll({
          scroll_id: search.body._scroll_id,
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
      const ident: { _index: string, _type?: unknown } = (ElasticsearchSchemaUtil.MAJOR_VER < 7 ?
        { _index: esIdent.index, _type: esIdent.type } :
        { _index: esIdent.index });

      if (op.delete) {
        acc.push({ delete: { ...ident, _id: op.delete.id } });
      } else if (op.insert) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        acc.push({ create: { ...ident, _id: op.insert.id } }, op.insert as T);
        delete op.insert.id;
      } else if (op.upsert) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        acc.push({ index: { ...ident, _id: op.upsert.id } }, op.upsert as T);
        delete op.upsert.id;
      } else if (op.update) {
        acc.push({ update: { ...ident, _id: op.update.id } }, { doc: op.update });
        // @ts-expect-error
        delete op.update.id;
      }
      return acc;
    }, []);

    const { body: res } = await this.client.bulk({
      body,
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
      const [k] = Object.keys<Record<Count | 'create' | 'index', unknown>>(item);
      const v = item[k]!;
      if (v.error) {
        out.errors.push(v.error);
        out.counts.error += 1;
      } else {
        let sk: Count;
        if (k === 'create') {
          sk = 'insert';
        } else if (k === 'index') {
          sk = operations[i].insert ? 'insert' : 'upsert';
        } else {
          sk = k;
        }

        if (v.result === 'created') {
          out.insertedIds.set(i, v._id);
          (operations[i].insert ?? operations[i].upsert)!.id = v._id;
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
    const res: SearchResponse<T> = await this.execSearch(cls, {
      body: ElasticsearchQueryUtil.getSearchBody(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body))
      )
    });
    if (!res.body.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx}`, key);
    }
    return this.postLoad(cls, res.body.hits.hits[0]._source);
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const res = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      body: ElasticsearchQueryUtil.getSearchBody(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body))
      ),
      refresh: true
    });
    if (res.body.deleted) {
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
    let search: SearchResponse<T> = await this.execSearch(cls, {
      scroll: '2m',
      size: 100,
      body: ElasticsearchQueryUtil.getSearchBody(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body, { emptySortValue: { $exists: true } }))
      ),
      sort: ElasticsearchQueryUtil.getSort(cfg.fields)
    });

    while (search.body.hits.hits.length > 0) {
      for (const el of search.body.hits.hits) {
        try {
          yield this.postLoad(cls, el._source);
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
        search = await this.client.scroll({
          scroll_id: search.body._scroll_id,
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
    return ModelQueryUtil.verifyGetSingleCounts(cls, await this.query(cls, { ...query, limit: failOnMany ? 2 : 1 }));
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    const req = ElasticsearchQueryUtil.getSearchObject(cls, { ...query, limit: 0 }, this.config.schemaConfig);
    const res: number | { value: number } = (await this.execSearch(cls, req)).body.hits.total || { value: 0 };
    return typeof res !== 'number' ? res.value : res;
  }

  // Query Crud
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const { body: res } = await this.client.deleteByQuery({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      body: undefined as unknown as {},
      ...this.manager.getIdentity(cls),
      refresh: true,
      ...ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, false)
    });
    return res.deleted ?? 0;
  }

  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {

    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const { body: res } = await this.client.updateByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      body: {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        query: (search.body as Record<string, unknown>).query,
        script
      }
    });

    return res.updated;
  }

  // Query Facet
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const q = ModelQuerySuggestUtil.getSuggestQuery(cls, field, prefix, query);
    const search = ElasticsearchQueryUtil.getSearchObject(cls, q);
    const res = await this.execSearch(cls, search);
    const safe = ElasticsearchQueryUtil.cleanIdRemoval<T>(search, res);
    const combined = ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, safe, (x, v) => v, query && query.limit);
    return Promise.all(combined.map(m => this.postLoad(cls, m)));
  }

  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const select: SelectClause<T> = { [field]: 1 } as SelectClause<T>;

    const q = ModelQuerySuggestUtil.getSuggestQuery(cls, field, prefix, {
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
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        query: (q.body as Record<string, unknown>).query ?? { ['match_all']: {} },
        aggs: { [field]: { terms: { field, size: 100 } } }
      },
      size: 0
    };

    const res = await this.execSearch(cls, search);
    const { buckets } = res.body.aggregations[field];
    const out = buckets.map(b => ({ key: b.key, count: b.doc_count }));
    return out;
  }
}