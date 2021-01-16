import * as es from '@elastic/elasticsearch';
import { Index, Update, Search, DeleteByQuery } from '@elastic/elasticsearch/api/requestParams';

import {
  ModelCrudSupport, BulkOp, BulkResponse, ModelBulkSupport,
  ModelIndexedSupport, ModelType, ModelStorageSupport, NotFoundError,
} from '@travetto/model';
import { ChangeEvent } from '@travetto/registry';
import { Class, Util, ShutdownManager } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { SchemaChangeEvent, SchemaConfig, SchemaRegistry } from '@travetto/schema';
import { ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySupport, PageableModelQuery, Query, ValidStringFields } from '@travetto/model-query';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { ElasticsearchModelConfig } from './config';
import { EsIdentity, EsBulkError } from './internal/types';
import { ElasticsearchQueryUtil } from './internal/query';
import { ElasticsearchSchemaUtil } from './internal/schema';
import { IndexManager } from './index-manager';
import { SearchResponse } from './types';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { ModelRegistry } from '@travetto/model/src/registry/model';

type WithId<T> = T & { _id?: string };

/**
 * Convert _id to id
 */
function postLoad<T extends ModelType>(o: T) {
  if ('_id' in o) {
    o.id = (o as WithId<T>)._id;
    delete (o as WithId<T>)._id;
  }
  return o;
}

/**
 * Elasticsearch model source.
 */
@Injectable()
export class ElasticsearchModelService implements
  ModelCrudSupport, ModelIndexedSupport,
  ModelStorageSupport, ModelBulkSupport,
  ModelQuerySupport, ModelQueryCrudSupport,
  ModelQueryFacetSupport {

  client: es.Client;
  manager: IndexManager;

  constructor(private config: ElasticsearchModelConfig) { }

  /**
   * Directly run the search
   */
  async execSearch<T>(cls: Class<T>, search: Search<unknown>): Promise<SearchResponse<T>> {
    const res = await this.client.search({
      ...this.manager.getIdentity(cls),
      ...search
    });
    return res as SearchResponse<T>;
  }

  async postConstruct() {
    this.client = new es.Client({
      nodes: this.config.hosts,
      ...(this.config.options || {})
    });
    await this.client.cluster.health({});
    ModelStorageUtil.registerModelChangeListener(this);
    this.manager = new IndexManager(this.config, this.client);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.close());
  }

  uuid() {
    return Util.uuid();
  }

  async onModelSchemaChange(e: SchemaChangeEvent) {
    await this.manager.onSchemaChange(e);
  }

  async onModelVisibilityChange<T extends ModelType>(e: ChangeEvent<Class<T>>) {
    await this.manager.onModelChange(e);
  }

  async createStorage() {
    await this.manager.createStorage();
  }

  async deleteStorage() {
    await this.manager.deleteStorage();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const res = await this.client.get({ ...this.manager.getIdentity(cls), id });
      return postLoad(await ModelCrudUtil.load(cls, res.body._source));
    } catch (err) {
      throw new NotFoundError(cls, id);
    }
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const { body: res } = await this.client.delete({
      ...this.manager.getIdentity(cls) as Required<EsIdentity>,
      id,
      refresh: 'true'
    });
    if (!res.found) {
      throw new NotFoundError(cls, id);
    }
  }

  async create<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    o = await ModelCrudUtil.preStore(cls, o, this);
    const id = o.id!;

    const { body: res } = await this.client.index({
      ...this.manager.getIdentity(cls) as Required<EsIdentity>,
      ... (id ? { id } : {}),
      refresh: 'true',
      body: o
    });

    o.id = res._id;
    return o;
  }

  async update<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = o.id!;

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      opType: 'index',
      refresh: 'true',
      body: o
    } as Index);

    o.id = id;
    return o;
  }

  async upsert<T extends ModelType>(cls: Class<T>, o: T) {
    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = o.id!;

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: 'true',
      body: {
        doc: o,
        doc_as_upsert: true
      }
    });

    o.id = id;
    return o;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, data: Partial<T>) {
    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);

    console.debug('Partial Script', { script });

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: 'true',
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
      body: {
        query: { match_all: {} }
      }
    });

    while (search.body.hits.hits.length > 0) {
      for (const el of search.body.hits.hits) {
        try {
          yield postLoad(await ModelCrudUtil.load(cls, el._source));
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
        delete op.insert.id;
      } else if (op.upsert) {
        acc.push({ index: { ...ident, _id: op.upsert.id } }, op.upsert);
        delete op.upsert.id;
      } else if (op.update) {
        acc.push({ update: { ...ident, _id: op.update.id } }, { doc: op.update });
        delete op.update.id;
      }
      return acc;
    }, [] as (T | Partial<Record<'delete' | 'create' | 'index' | 'update', { _index: string, _id?: string }>> | { doc: T })[]);

    const { body: res } = await this.client.bulk({
      body,
      refresh: 'true'
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

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res: SearchResponse<T> = await this.execSearch(cls, {
      body: {
        query: ElasticsearchQueryUtil.extractWhereTermQuery(ModelIndexedUtil.projectIndex(cls, idx, body, null), cls)
      }
    });
    if (!res.body.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
    }
    return postLoad(await ModelCrudUtil.load(cls, res.body.hits.hits[0]._source));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      body: {
        query: ElasticsearchQueryUtil.extractWhereTermQuery(ModelIndexedUtil.projectIndex(cls, idx, body, null), cls)
      }
    });
    if (res.body.deleted) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
  }

  // Query
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    const req = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, true);
    const results = await this.execSearch(cls, req);
    const items = ElasticsearchQueryUtil.cleanIdRemoval(req, results);
    return Promise.all(items.map(m => ModelCrudUtil.load(cls, m).then(postLoad)));
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean): Promise<T> {
    return ModelQueryUtil.verifyGetSingleCounts(cls, await this.query(cls, { ...query, limit: failOnMany ? 2 : 1 }));
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    const req = ElasticsearchQueryUtil.getSearchObject(cls, { ...query, limit: 0 }, this.config.schemaConfig, true);
    const res = (await this.execSearch(cls, req)).body.hits.total as (number | { value: number } | undefined);
    return res ? typeof res === 'number' ? res : res.value : 0;
  }

  // Query Crud
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const { body: res } = await this.client.deleteByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      ...ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig)
    } as DeleteByQuery);
    return res.deleted ?? 0;
  }

  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {

    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);

    const { body: res } = await this.client.updateByQuery({
      ...this.manager.getIdentity(cls),
      refresh: true,
      body: {
        query: ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig).body.query,
        script
      }
    });

    return res.updated;
  }

  // Query Facet
  /**
   * Build query to support searching multiple fields
   */
  buildSuggestQuery<T extends ModelType>(
    cls: Class<T>, field: ValidStringFields<T>, q?: string,
    filter?: Query<T>
  ) {
    const spec = SchemaRegistry.getViewSchema(cls).schema[field as keyof SchemaConfig].specifier;
    const text = spec && spec.startsWith('text');

    if (!text) {
      console.warn(`${cls.ᚕid}.${field} is not registered as @Text, reverting to keyword search`);
    }

    const searchObj = ElasticsearchQueryUtil.getSearchObject(cls, filter ?? {});
    const conf = ModelRegistry.get(cls);

    return {
      ...searchObj,
      ...this.manager.getIdentity(cls),
      body: {
        query: {
          bool: {
            must: [
              searchObj.body.query ?? { ['match_all']: {} },
              ...(q ? [{ ['match_phrase_prefix']: { [text ? `${field}.text` : field]: { query: q } } }] : [])
            ],
            ...(conf.subType ? { filter: { term: { type: conf.subType } } } : {})
          }
        }
      },
      size: filter?.limit ?? 10
    };
  }

  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const search = this.buildSuggestQuery(cls, field, prefix, query);
    const res = await this.execSearch(cls, search);
    const safe = ElasticsearchQueryUtil.cleanIdRemoval<T>(search, res);
    const combined = ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, safe, (x, v) => v, query && query.limit);
    return Promise.all(combined.map(m => ModelCrudUtil.load(cls, m).then(postLoad)));
  }

  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    const search = this.buildSuggestQuery(cls, field, prefix, {
      // @ts-ignore
      select: { [field]: 1 },
      ...query
    });
    const res = await this.execSearch(cls, search);
    const safe = ElasticsearchQueryUtil.cleanIdRemoval(search, res);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, safe, x => x, query && query.limit);
  }

  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const q = ElasticsearchQueryUtil.getSearchObject(cls, query ?? {}, this.config.schemaConfig);

    const search = {
      ...this.manager.getIdentity(cls),
      body: {
        query: q.body.query ?? { ['match_all']: {} },
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