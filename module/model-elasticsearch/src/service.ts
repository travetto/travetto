import * as es from '@elastic/elasticsearch';
import { Index, Update, Search, DeleteByQuery } from '@elastic/elasticsearch/api/requestParams';

import {
  ModelCrudSupport, BulkOp, BulkResponse, ModelBulkSupport, ModelExpirySupport,
  ModelIndexedSupport, ModelType, ModelStorageSupport, NotFoundError, ModelRegistry,
  SubTypeNotSupportedError
} from '@travetto/model';
import { Class, Util, ShutdownManager } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { SchemaChange } from '@travetto/schema';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport,
  ModelQuerySupport, PageableModelQuery, Query, ValidStringFields
} from '@travetto/model-query';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelQuerySuggestSupport } from '@travetto/model-query/src/service/suggest';

import { ElasticsearchModelConfig } from './config';
import { EsIdentity, EsBulkError } from './internal/types';
import { ElasticsearchQueryUtil } from './internal/query';
import { ElasticsearchSchemaUtil } from './internal/schema';
import { IndexManager } from './index-manager';
import { SearchResponse } from './types';

type WithId<T> = T & { _id?: string };

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
      ...search as Search<T>
    });
    return res as unknown as SearchResponse<T>;
  }

  /**
   * Convert _id to id
   */
  async postLoad<T extends ModelType>(cls: Class<T>, o: T) {
    if ('_id' in o) {
      (o as { id?: unknown }).id = (o as WithId<T>)._id;
      delete (o as WithId<T>)._id;
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

  async postConstruct(this: ElasticsearchModelService) {
    this.client = new es.Client({
      nodes: this.config.hosts,
      ...(this.config.options || {})
    });
    await this.client.cluster.health({});
    this.manager = new IndexManager(this.config, this.client);

    await ModelStorageUtil.registerModelChangeListener(this.manager, this.constructor as Class);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.close());
    ModelExpiryUtil.registerCull(this);
  }

  createStorage() { return this.manager.createStorage(); }
  deleteStorage() { return this.manager.deleteStorage(); }
  createModel(cls: Class) { return this.manager.createModel(cls); }
  exportModel(cls: Class) { return this.manager.exportModel(cls); }
  deleteModel(cls: Class) { return this.manager.deleteModel(cls); }
  changeSchema(cls: Class, change: SchemaChange) { return this.manager.changeSchema(cls, change); }
  truncateModel(cls: Class) { return this.deleteByQuery(cls, {}).then(() => { }); }

  uuid() {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const res = await this.client.get({ ...this.manager.getIdentity(cls), id });
      return this.postLoad(cls, res.body._source);
    } catch (err) {
      throw new NotFoundError(cls, id);
    }
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    try {
      const { body: res } = await this.client.delete({
        ...this.manager.getIdentity(cls) as Required<EsIdentity>,
        id,
        refresh: true
      });
      if (res.result === 'not_found') {
        throw new NotFoundError(cls, id);
      }
    } catch (err) {
      if (err.body && err.body.result === 'not_found') {
        throw new NotFoundError(cls, id);
      }
      throw err;
    }
  }

  async create<T extends ModelType>(cls: Class<T>, o: Partial<T>): Promise<T> {
    try {
      const clean = await ModelCrudUtil.preStore(cls, o, this);
      const id = clean.id;

      await this.client.index({
        ...this.manager.getIdentity(cls) as Required<EsIdentity>,
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
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = o.id;

    if (ModelRegistry.get(cls).expiresAt) {
      await this.get(cls, id);
    }

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      opType: 'index',
      refresh: true,
      body: o
    } as Index);

    o.id = id;
    return o;
  }

  async upsert<T extends ModelType>(cls: Class<T>, o: Partial<T>) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

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

  async updatePartial<T extends ModelType>(cls: Class<T>, data: Partial<T> & { id: string }) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

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
    } as Update);

    return this.get(cls, id);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
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

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]) {

    // Pre store
    for (const el of operations) {
      if ('insert' in el && el.insert) {
        el.insert = await ModelCrudUtil.preStore(cls, el.insert, this);
      } else if ('update' in el && el.update) {
        el.update = await ModelCrudUtil.preStore(cls, el.update, this);
      } else if ('upsert' in el && el.upsert) {
        el.upsert = await ModelCrudUtil.preStore(cls, el.upsert, this);
      }
    }

    const body = operations.reduce((acc, op) => {

      const esIdent = this.manager.getIdentity((op.upsert ?? op.delete ?? op.insert ?? op.update ?? { constructor: cls }).constructor as Class);
      const ident = (ElasticsearchSchemaUtil.MAJOR_VER < 7 ?
        { _index: esIdent.index, _type: esIdent.type } :
        { _index: esIdent.index }) as { _index: string };

      if (op.delete) {
        acc.push({ delete: { ...ident, _id: op.delete.id } });
      } else if (op.insert) {
        acc.push({ create: { ...ident, _id: op.insert.id } }, op.insert);
        delete (op.insert as { id?: unknown }).id;
      } else if (op.upsert) {
        acc.push({ index: { ...ident, _id: op.upsert.id } }, op.upsert);
        delete (op.upsert as { id?: unknown }).id;
      } else if (op.update) {
        acc.push({ update: { ...ident, _id: op.update.id } }, { doc: op.update });
        delete (op.update as { id?: unknown }).id;
      }
      return acc;
    }, [] as (T | Partial<Record<'delete' | 'create' | 'index' | 'update', { _index: string, _id?: string }>> | { doc: T })[]);

    const { body: res } = await this.client.bulk({
      body,
      refresh: true
    });

    const out: BulkResponse = {
      counts: {
        delete: 0,
        insert: 0,
        upsert: 0,
        update: 0,
        error: 0
      },
      insertedIds: new Map(),
      errors: [] as EsBulkError[]
    };

    type Count = keyof typeof out['counts'];

    for (let i = 0; i < res.items.length; i++) {
      const item = res.items[i];
      const [k] = Object.keys(item) as (Count | 'create' | 'index')[];
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
  deleteExpired<T extends ModelType>(cls: Class<T>) {
    return ModelQueryExpiryUtil.deleteExpired(this, cls);
  }

  // Indexed
  getIndexQuery<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    return ElasticsearchQueryUtil.getSearchBody(
      cls, ElasticsearchQueryUtil.extractWhereTermQuery(
        cls, ModelIndexedUtil.projectIndex(
          cls, idx, body, null
        )
      )
    );
  }

  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res: SearchResponse<T> = await this.execSearch(cls, { body: this.getIndexQuery(cls, idx, body) });
    if (!res.body.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
    }
    return this.postLoad(cls, res.body.hits.hits[0]._source);
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      body: this.getIndexQuery(cls, idx, body),
      refresh: true
    });
    if (res.body.deleted) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
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
    const res = (await this.execSearch(cls, req)).body.hits.total as (number | { value: number } | undefined);
    return res ? typeof res === 'number' ? res : res.value : 0;
  }

  // Query Crud
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const { body: res } = await this.client.deleteByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      ...ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, false)
    } as DeleteByQuery);
    return res.deleted ?? 0;
  }

  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {

    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const { body: res } = await this.client.updateByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      body: {
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
    const q = ModelQuerySuggestUtil.getSuggestQuery(cls, field, prefix, {
      // @ts-ignore
      select: { [field]: 1 },
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
        query: (q.body as Record<string, unknown>).query ?? { ['match_all']: {} },
        aggs: { [field]: { terms: { field, size: 100 } } }
      },
      size: 0
    };

    const res = await this.execSearch(cls, search);
    const { buckets } = res.body.aggregations[field as string];
    const out = buckets.map(b => ({ key: b.key, count: b.doc_count }));
    return out;
  }
}