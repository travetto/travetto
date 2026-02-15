import { Client, errors, Serializer } from '@elastic/elasticsearch';
import type * as estypes from '@elastic/elasticsearch/api/types';

import {
  type ModelCrudSupport, type BulkOperation, type BulkResponse, type ModelBulkSupport, type ModelExpirySupport,
  type ModelIndexedSupport, type ModelType, type ModelStorageSupport, NotFoundError, ModelRegistryIndex, type OptionalId,
  ModelCrudUtil, ModelIndexedUtil, ModelStorageUtil, ModelExpiryUtil, ModelBulkUtil,
} from '@travetto/model';
import { ShutdownManager, type DeepPartial, type Class, castTo, asFull, TypedObject, asConstructable, JSONUtil } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import {
  type ModelQuery, type ModelQueryCrudSupport, type ModelQueryFacetSupport,
  type ModelQuerySupport, type PageableModelQuery, type Query, type ValidStringFields,
  QueryVerifier, type ModelQuerySuggestSupport,
  ModelQueryUtil, ModelQuerySuggestUtil, ModelQueryCrudUtil,
  type ModelQueryFacet,
} from '@travetto/model-query';

import type { ElasticsearchModelConfig } from './config.ts';
import type { EsBulkError } from './internal/types.ts';
import { ElasticsearchQueryUtil } from './internal/query.ts';
import { ElasticsearchSchemaUtil } from './internal/schema.ts';
import { IndexManager } from './index-manager.ts';

const ELASTICSEARCH_REPLACER = {
  replacer(this: unknown, key: string, value: unknown): unknown {
    // @ts-expect-error
    return (typeof this[key] === 'bigint' ? this[key].toString() : value);
  }
};

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

  async postConstruct(this: ElasticsearchModelService): Promise<void> {
    this.client = new Client({
      nodes: this.config.hosts,
      ...(this.config.options || {}),
      Serializer: class extends Serializer {
        deserialize = JSONUtil.fromUTF8;
        serialize = (obj: unknown): string => JSONUtil.toUTF8(obj, ELASTICSEARCH_REPLACER);
      }
    });
    await this.client.cluster.health({});
    this.manager = new IndexManager(this.config, this.client);

    await ModelStorageUtil.storageInitialization(this.manager);
    ShutdownManager.signal.addEventListener('abort', () => this.client.close());
    ModelExpiryUtil.registerCull(this);
  }

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
    } catch (error) {
      if (error instanceof errors.ResponseError && error.meta.body && typeof error.meta.body === 'object' && 'error' in error.meta.body) {
        console.error(error.meta.body.error);
      }
      throw error;
    }
  }

  preUpdate(item: { id: string }): string;
  preUpdate(item: {}): undefined;
  preUpdate(item: { id?: string }): string | undefined {
    if ('id' in item && typeof item.id === 'string') {
      const id = item.id;
      if (!this.config.storeId) {
        delete item.id;
      }
      return id;
    }
    return;
  }

  postUpdate<T extends ModelType>(item: T, id?: string): T {
    if (!this.config.storeId) {
      item.id = id!;
    }
    return item;
  }

  /**
   * Convert _id to id
   */
  async postLoad<T extends ModelType>(cls: Class<T>, input: estypes.SearchHit<T> | estypes.GetGetResult<T>): Promise<T> {
    let item = {
      ...(input._id ? { id: input._id } : {}),
      ...input._source!,
    };

    item = await ModelCrudUtil.load(cls, item);

    const { expiresAt } = ModelRegistryIndex.getConfig(cls);

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

  createStorage(): Promise<void> { return this.manager.createStorage(); }
  deleteStorage(): Promise<void> { return this.manager.deleteStorage(); }
  upsertModel(cls: Class): Promise<void> { return this.manager.upsertModel(cls); }
  exportModel(cls: Class): Promise<string> { return this.manager.exportModel(cls); }
  deleteModel(cls: Class): Promise<void> { return this.manager.deleteModel(cls); }
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
    } catch (error) {
      if (error && error instanceof errors.ResponseError && error.body && error.body.result === 'not_found') {
        throw new NotFoundError(cls, id);
      }
      throw error;
    }
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const clean = await ModelCrudUtil.preStore(cls, item, this);
    const id = this.preUpdate(clean);

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      refresh: true,
      body: castTo<T & { id: never }>(clean)
    });

    return this.postUpdate(clean, id);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    item = await ModelCrudUtil.preStore(cls, item, this);

    const id = this.preUpdate(item);

    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
      await this.get(cls, id);
    }

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      op_type: 'index',
      refresh: true,
      body: castTo<T & { id: never }>(item)
    });

    return this.postUpdate(item, id);
  }

  async upsert<T extends ModelType>(cls: Class<T>, input: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const item = await ModelCrudUtil.preStore(cls, input, this);
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
    } catch (error) {
      if (error instanceof Error && /document_missing_exception/.test(error.message)) {
        throw new NotFoundError(cls, id);
      }
      throw error;
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
      for (const hit of search.hits.hits) {
        try {
          yield this.postLoad(cls, hit);
        } catch (error) {
          if (!(error instanceof NotFoundError)) {
            throw error;
          }
        }
        search = await this.client.scroll({
          scroll_id: search._scroll_id,
          scroll: '2m'
        });
      }
    }
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse<EsBulkError>> {

    await ModelBulkUtil.preStore(cls, operations, this);

    type BulkDoc = Partial<Record<'delete' | 'create' | 'index' | 'update', { _index: string, _id?: string }>>;
    const body = operations.reduce<(T | BulkDoc | { doc: T })[]>((toRun, operation) => {

      const core = (operation.upsert ?? operation.delete ?? operation.insert ?? operation.update ?? { constructor: cls });
      const { index } = this.manager.getIdentity(asConstructable<T>(core).constructor);
      const identity: { _index: string, _type?: unknown } = { _index: index };

      if (operation.delete) {
        toRun.push({ delete: { ...identity, _id: operation.delete.id } });
      } else if (operation.insert) {
        const id = this.preUpdate(operation.insert);
        toRun.push({ create: { ...identity, _id: id } }, castTo(operation.insert));
      } else if (operation.upsert) {
        const id = this.preUpdate(operation.upsert);
        toRun.push({ index: { ...identity, _id: id } }, castTo(operation.upsert));
      } else if (operation.update) {
        const id = this.preUpdate(operation.update);
        toRun.push({ update: { ...identity, _id: id } }, { doc: operation.update });
      }
      return toRun;
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

    type CountProperty = keyof typeof out['counts'];

    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      const [key] = TypedObject.keys(item);
      const responseItem = item[key]!;
      if (responseItem.error) {
        out.errors.push({
          reason: responseItem.error!.reason!,
          type: responseItem.error!.type
        });
        out.counts.error += 1;
      } else {
        let property: CountProperty;
        switch (key) {
          case 'create': property = 'insert'; break;
          case 'index': property = operations[i].insert ? 'insert' : 'upsert'; break;
          case 'delete': case 'update': property = key; break;
          default: {
            throw new Error(`Unknown response key: ${key}`);
          }
        }

        if (responseItem.result === 'created') {
          out.insertedIds.set(i, responseItem._id!);
          (operations[i].insert ?? operations[i].upsert)!.id = responseItem._id!;
        }

        out.counts[property] += 1;
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
    const config = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);
    let search = await this.execSearch<T>(cls, {
      scroll: '2m',
      size: 100,
      query: ElasticsearchQueryUtil.getSearchQuery(cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(cls,
          ModelIndexedUtil.projectIndex(cls, idx, body, { emptySortValue: { $exists: true } }))
      ),
      sort: ElasticsearchQueryUtil.getSort(config.fields)
    });

    while (search.hits.hits.length > 0) {
      for (const hit of search.hits.hits) {
        try {
          yield this.postLoad(cls, hit);
        } catch (error) {
          if (!(error instanceof NotFoundError)) {
            throw error;
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

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const results = await this.execSearch(cls, search);
    const shouldRemoveIds = query.select && 'id' in query.select && !query.select.id;
    return Promise.all(results.hits.hits.map(hit => this.postLoad(cls, hit).then(item => {
      if (shouldRemoveIds) {
        delete castTo<OptionalId<T>>(item).id;
      }
      return item;
    })));
  }

  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany: boolean = true): Promise<T> {
    const result = await this.query<T>(cls, { ...query, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts<T>(cls, failOnMany, result, query.where);
  }

  async queryCount<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, { ...query, limit: 0 }, this.config.schemaConfig);
    const result: number | { value: number } = (await this.execSearch(cls, search)).hits.total || { value: 0 };
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

    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
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
    } catch (error) {
      if (error instanceof errors.ResponseError && 'version_conflicts' in error.body) {
        throw new NotFoundError(cls, id);
      } else {
        throw error;
      }
    }

    return this.postUpdate(item, id);
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const { sort: _, ...rest } = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, false);
    const result = await this.client.deleteByQuery({
      ...this.manager.getIdentity(cls),
      ...rest,
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

    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const search = ElasticsearchQueryUtil.getSearchObject(cls, resolvedQuery);
    const result = await this.execSearch(cls, search);
    const all = await Promise.all(result.hits.hits.map(hit => this.postLoad(cls, hit)));
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, all, (_, value) => value, query && query.limit);
  }

  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    await QueryVerifier.verify(cls, query);

    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, {
      select: castTo({ [field]: 1 }),
      ...query
    });
    const search = ElasticsearchQueryUtil.getSearchObject(cls, resolvedQuery);
    const result = await this.execSearch(cls, search);
    const all = result.hits.hits.map(hit => castTo<T>(({ [field]: field === 'id' ? hit._id : hit._source![field] })));
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, all, item => item, query && query.limit);
  }

  // Facet
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(cls, query);

    const resolvedSearch = ElasticsearchQueryUtil.getSearchObject(cls, query ?? {}, this.config.schemaConfig);

    const search: estypes.SearchRequest = {
      query: resolvedSearch.query ?? { ['match_all']: {} },
      aggs: { [field]: { terms: { field, size: 100 } } },
      size: 0
    };

    const result = await this.execSearch(cls, search);
    const { buckets } = castTo<estypes.AggregationsStringTermsAggregate>('buckets' in result.aggregations![field] ? result.aggregations![field] : { buckets: [] });
    const out = Array.isArray(buckets) ? buckets.map(b => ({ key: b.key!.toString(), count: b.doc_count })) : [];
    return out;
  }
}