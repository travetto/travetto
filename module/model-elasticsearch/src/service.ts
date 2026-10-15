import { Client, errors, Serializer } from '@elastic/elasticsearch';
import type {
  SearchRequest,
  SortResults,
  GetGetResult,
  SearchHit,
  SearchResponse,
  AggregationsStringTermsAggregate
} from '@elastic/elasticsearch/api/types';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  type BulkOperation,
  type BulkResponse,
  type ModelBulkSupport,
  ModelBulkUtil,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelExpirySupport,
  ModelExpiryUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  ModelStorageUtil,
  type ModelType,
  NotFoundError
} from '@travetto/model';
import {
  type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody,
  type KeyedIndexBody,
  type KeyedIndexSelection,
  ModelIndexedComputedIndex,
  type ModelIndexedSearchOptions,
  type ModelIndexedSupport,
  ModelIndexedUtil,
  type ModelPageOptions,
  type ModelPageResult,
  type SingleItemIndex,
  type SortedIndex,
  type SortedIndexSelection
} from '@travetto/model-indexed';
import {
  type FieldAggregateResult,
  type ModelQuery,
  type ModelQueryAggregateSupport,
  ModelQueryAggregateUtil,
  type ModelQueryCrudSupport,
  ModelQueryCrudUtil,
  type ModelQueryFacet,
  type FacetModelQuery,
  type ModelQueryFacetSupport,
  type ModelQuerySuggestSupport,
  ModelQuerySuggestUtil,
  type ModelQuerySupport,
  ModelQueryUtil,
  type NumberFieldAggregateResult,
  type PageableModelQuery,
  type Query,
  QueryVerifier,
  type SuggestModelQuery,
  type ValidComparableFields,
  type ValidStringFields,
  type WhereClause
} from '@travetto/model-query';
import { asConstructable, asFull, type Class, castTo, JSONUtil, ShutdownManager, TypedObject } from '@travetto/runtime';
import { castKey } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import type { ElasticsearchModelConfig } from './config.ts';
import { IndexManager } from './index-manager.ts';
import { ElasticsearchQueryUtil } from './internal/query.ts';
import { ElasticsearchSchemaUtil } from './internal/schema.ts';
import type { EsBulkError } from './internal/types.ts';

const ELASTICSEARCH_REPLACER = {
  replacer(this: unknown, key: string, value: unknown): unknown {
    // @ts-expect-error
    return typeof this[key] === 'bigint' ? this[key].toString() : value;
  }
};

/**
 * Elasticsearch model source.
 */
@Injectable()
export class ElasticsearchModelService
  implements
    ModelCrudSupport,
    ModelIndexedSupport,
    ModelStorageSupport,
    ModelBulkSupport,
    ModelExpirySupport,
    ModelQuerySupport,
    ModelQueryAggregateSupport,
    ModelQueryCrudSupport,
    ModelQuerySuggestSupport,
    ModelQueryFacetSupport
{
  client: Client;
  manager: IndexManager;
  config: ElasticsearchModelConfig;

  constructor(config: ElasticsearchModelConfig) {
    this.config = config;
  }

  /**
   * Convert _id to id
   */
  async #postLoad<T extends ModelType>(cls: Class<T>, input: SearchHit<T> | GetGetResult<T>): Promise<T> {
    let item = {
      ...(input._id ? { id: input._id } : {}),
      ...input._source!
    };

    item = await ModelCrudUtil.load(cls, item);

    const { expiresAt } = ModelRegistryIndex.getConfig(cls);

    if (expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, item);
      if (!expiry.expired) {
        return item;
      }
      throw ModelRegistryIndex.getIdSource(cls).getNotFoundError(item);
    } else {
      return item;
    }
  }

  async *#scrollCollection<T extends ModelType>(
    cls: Class<T>,
    buildSearch: (offset?: SortResults) => SearchRequest,
    options?: ModelPageOptions<SortResults> & ModelListOptions
  ): AsyncIterable<{ items: T[]; nextOffset?: SortResults | undefined }> {
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(limit, options?.batchSizeHint ?? 100);

    let search: SearchResponse<T> = await this.execSearch<T>(cls, {
      size: batchSize,
      ...buildSearch(options?.offset)
    });

    let hits = search.hits.hits;
    let produced = 0;

    while (produced < limit && hits.length && !options?.abort?.aborted) {
      hits = search.hits.hits;
      produced += hits.length;
      if (produced > limit) {
        hits = hits.slice(0, limit - (produced - hits.length));
      }
      const items = await ModelCrudUtil.filterOutNotFound(hits.map(hit => this.#postLoad(cls, hit)));
      const nextOffset = hits.at(-1)?.sort;
      yield { items, nextOffset };
      if (search._scroll_id) {
        search = await this.client.scroll({ scroll_id: search._scroll_id });
      } else if (nextOffset) {
        search = await this.execSearch<T>(cls, {
          size: batchSize,
          ...buildSearch(nextOffset)
        });
      } else {
        hits = [];
      }
    }
    if (search._scroll_id) {
      await this.client.clearScroll({ scroll_id: search._scroll_id }).catch(() => {});
    }
  }

  async *#scrollIndex<T extends ModelType>(
    cls: Class<T>,
    idx: SortedIndex<T>,
    body: KeyedIndexBody<T>,
    options?: ModelPageOptions<SortResults> & ModelListOptions,
    transformWhere?: (where: WhereClause<T>) => WhereClause<T>
  ): AsyncIterable<{
    items: T[];
    nextOffset?: SortResults | undefined;
  }> {
    const computed = ModelIndexedComputedIndex.get(idx, body).validate();
    let whereClause: WhereClause<T> = castTo(computed.project());
    if (transformWhere) {
      whereClause = transformWhere(whereClause);
    }

    yield* this.#scrollCollection(
      cls,
      offset => {
        const result = {
          query: ElasticsearchQueryUtil.getSearchQuery(cls, ElasticsearchQueryUtil.extractWhereQuery(cls, whereClause)),
          ...(offset ? { search_after: offset } : {}),
          sort: ElasticsearchQueryUtil.getSort(idx)
        };
        return result;
      },
      options
    );
  }

  @PostConstruct()
  async initializeClient(this: ElasticsearchModelService): Promise<void> {
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
  async execSearch<T extends ModelType>(cls: Class<T>, search: SearchRequest): Promise<SearchResponse<T>> {
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

  preUpdate<T extends ModelType>(cls: Class<T>, item: Partial<T>): string | undefined {
    const idSource = ModelRegistryIndex.getIdSource(cls);
    const id = idSource.getOptionalValue(item);
    if (id) {
      if (!this.config.storeId) {
        idSource.deleteValue(item);
      }
      return id;
    }
    return;
  }

  postUpdate<T extends ModelType>(cls: Class<T>, item: T, id?: string): T {
    if (!this.config.storeId && id) {
      ModelRegistryIndex.getIdSource(cls).setValue(item, id);
    }
    return item;
  }

  createStorage(): Promise<void> {
    return this.manager.createStorage();
  }
  deleteStorage(): Promise<void> {
    return this.manager.deleteStorage();
  }
  upsertModel(cls: Class): Promise<void> {
    return this.manager.upsertModel(cls);
  }
  exportModel(cls: Class): Promise<string> {
    return this.manager.exportModel(cls);
  }
  deleteModel(cls: Class): Promise<void> {
    return this.manager.deleteModel(cls);
  }
  truncateModel(cls: Class): Promise<void> {
    return this.manager.truncateModel(cls);
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    try {
      const result = await this.client.get<T>({ ...this.manager.getIdentity(cls), id });
      return this.#postLoad(cls, result);
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
        refresh: true
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

  async create<T extends ModelType>(cls: Class<T>, item: Partial<T>): Promise<T> {
    const [, clean] = await ModelCrudUtil.preStore(cls, item);
    const id = this.preUpdate(cls, clean)!;

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      refresh: true,
      body: clean
    });

    return this.postUpdate(cls, clean, id);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const [, prepped] = await ModelCrudUtil.preStore(cls, item);
    item = prepped;

    const id = this.preUpdate(cls, item)!;

    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
      await this.get(cls, id);
    }

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      op_type: 'index',
      refresh: true,
      body: item
    });

    return this.postUpdate(cls, item, id);
  }

  async upsert<T extends ModelType>(cls: Class<T>, input: Partial<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const [, item] = await ModelCrudUtil.preStore(cls, input);
    const id = this.preUpdate(cls, item)!;

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: true,
      doc: item,
      doc_as_upsert: true
    });

    return this.postUpdate(cls, item, id);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, data: Partial<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const id = ModelRegistryIndex.getIdSource(cls).getValue(data);
    const item = await ModelCrudUtil.prePartialUpdate(cls, data);
    const script = ElasticsearchSchemaUtil.generateUpdateScript(item);

    try {
      await this.client.update({
        ...this.manager.getIdentity(cls),
        id,
        refresh: true,
        script
      });
    } catch (error) {
      if (error instanceof Error && /document_missing_exception/.test(error.message)) {
        throw new NotFoundError(cls, id);
      }
      throw error;
    }

    return this.get(cls, id);
  }

  async *list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const batch of this.#scrollCollection(
      cls,
      () => ({
        query: ElasticsearchQueryUtil.getSearchQuery(cls, {}),
        scroll: '2m'
      }),
      options
    )) {
      yield batch.items;
    }
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse<EsBulkError>> {
    await ModelBulkUtil.preStore(cls, operations);

    type BulkDoc = Partial<Record<'delete' | 'create' | 'index' | 'update', { _index: string; _id?: string }>>;
    const body = operations.reduce<(T | BulkDoc | { doc: T })[]>((toRun, operation) => {
      const core = operation.upsert ?? operation.delete ?? operation.insert ?? operation.update ?? { constructor: cls };
      const { index } = this.manager.getIdentity(asConstructable<T>(core).constructor);
      const identity: { _index: string; _type?: unknown } = { _index: index };

      if (operation.delete) {
        toRun.push({ delete: { ...identity, _id: ModelRegistryIndex.getIdSource(cls).getOptionalValue(operation.delete)! } });
      } else if (operation.insert) {
        const id = this.preUpdate(cls, operation.insert);
        toRun.push({ create: { ...identity, _id: id } }, operation.insert);
      } else if (operation.upsert) {
        const id = this.preUpdate(cls, operation.upsert);
        toRun.push({ index: { ...identity, _id: id } }, operation.upsert);
      } else if (operation.update) {
        const id = this.preUpdate(cls, operation.update);
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

    type CountProperty = keyof (typeof out)['counts'];

    for (let i = 0; i < result.items.length; i += 1) {
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
          case 'create':
            property = 'insert';
            break;
          case 'index':
            property = operations[i].insert ? 'insert' : 'upsert';
            break;
          case 'delete':
          case 'update':
            property = key;
            break;
          default: {
            throw new Error(`Unknown response key: ${key}`);
          }
        }

        if (responseItem.result === 'created') {
          out.insertedIds.set(i, responseItem._id!);
          ModelRegistryIndex.getIdSource(cls).setValue((operations[i].insert ?? operations[i].upsert)!, responseItem._id!);
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
  async getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });
    const projected = computed.project({
      sort: true,
      includeId: true,
      emptyValue: { $exists: true }
    });

    const result = await this.execSearch<T>(cls, {
      query: ElasticsearchQueryUtil.getSearchQuery(cls, ElasticsearchQueryUtil.extractWhereTermQuery(cls, projected))
    });
    if (!result.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx.name}`, computed.getKey({ sort: true }));
    }
    return this.#postLoad(cls, result.hits.hits[0]);
  }

  async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });
    const result = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      query: ElasticsearchQueryUtil.getSearchQuery(
        cls,
        ElasticsearchQueryUtil.extractWhereTermQuery(
          cls,
          computed.project({
            sort: true,
            includeId: true,
            emptyValue: { $exists: true }
          })
        )
      ),
      refresh: true
    });
    if (!result.deleted) {
      throw new NotFoundError(`${cls.name}: ${idx}`, computed.getKey({ sort: true }));
    }
  }

  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: Partial<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: T
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    const item = await ModelCrudUtil.naivePartialUpdate(cls, () => this.getByIndex(cls, idx, body), castTo(body));
    return this.update(cls, item);
  }

  async pageByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions
  ): Promise<ModelPageResult<T>> {
    const offset = options?.offset ? JSONUtil.fromBase64<SortResults>(options.offset) : undefined;
    const items: T[] = [];
    let lastNextOffset: SortResults | undefined;
    for await (const { items: fetched, nextOffset } of this.#scrollIndex(cls, idx, body, { limit: 100, ...options, offset })) {
      lastNextOffset = nextOffset;
      items.push(...fetched);
    }
    return { items, nextOffset: lastNextOffset ? JSONUtil.toBase64(lastNextOffset) : undefined };
  }

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    for await (const { items } of this.#scrollIndex(cls, idx, body, options)) {
      yield items;
    }
  }

  async suggestByIndex<T extends ModelType, S extends SortedIndexSelection<T>, K extends KeyedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    prefix: string,
    options?: ModelIndexedSearchOptions
  ): Promise<T[]> {
    const items: T[] = [];
    for await (const { items: fetched } of this.#scrollIndex(cls, idx, body, { limit: 10, ...options }, where =>
      castTo({
        $and: [
          where,
          {
            [idx.sortTemplate[0].path.join('.')]: { $regex: ModelIndexedUtil.getSuggestRegex(prefix) }
          }
        ]
      })
    )) {
      items.push(...fetched);
    }
    return items;
  }

  // Query
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);
    const results = await this.execSearch(cls, search);
    const idSource = ModelRegistryIndex.getIdSource(cls);
    const idFieldName = idSource.field;
    const shouldRemoveIds = query.select && idFieldName in query.select && !query.select[castKey(idFieldName)];
    return Promise.all(
      results.hits.hits.map(hit =>
        this.#postLoad(cls, hit).then(item => {
          if (shouldRemoveIds) {
            idSource.deleteValue(item);
          }
          return item;
        })
      )
    );
  }

  async getByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany: boolean = true): Promise<T> {
    const result = await this.query<T>(cls, { ...query, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts<T>(cls, failOnMany, result, query.where);
  }

  async countByQuery<T extends ModelType>(cls: Class<T>, query: Query<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const search = ElasticsearchQueryUtil.getSearchObject(cls, { ...query, limit: 0 }, this.config.schemaConfig);
    const result: number | { value: number } = (await this.execSearch(cls, search)).hits.total || { value: 0 };
    return typeof result !== 'number' ? result.value : result;
  }

  // Query Crud
  async updateByQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    await QueryVerifier.verify(cls, query);

    const [id, item] = await ModelCrudUtil.preStore(cls, data);
    this.preUpdate(cls, item);

    let where = ModelQueryUtil.getWhereClause(cls, query.where);
    if (id) {
      where = {
        ...where,
        ...ModelRegistryIndex.getIdSource(cls).getWhereClause(id)
      };
    }
    query.where = where;

    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
      await this.get(cls, id!);
    }

    const search = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig);

    const copy = BindUtil.bindSchemaToObject(cls, asFull<T>({}), item);

    try {
      const result = await this.client.updateByQuery({
        ...this.manager.getIdentity(cls),
        refresh: true,
        query: search.query,
        max_docs: 1,
        script: ElasticsearchSchemaUtil.generateReplaceScript(copy)
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

    return this.postUpdate(cls, item, id);
  }

  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    await QueryVerifier.verify(cls, query);

    const { sort: _, ...rest } = ElasticsearchQueryUtil.getSearchObject(cls, query, this.config.schemaConfig, false);
    const result = await this.client.deleteByQuery({
      ...this.manager.getIdentity(cls),
      ...rest,
      refresh: true
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
      script
    });

    return result.updated ?? 0;
  }

  // Query Facet
  async suggestByQuery<T extends ModelType>(
    cls: Class<T>,
    field: ValidStringFields<T>,
    prefix?: string,
    query?: SuggestModelQuery<T>
  ): Promise<T[]> {
    await QueryVerifier.verify(cls, query);

    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const search = ElasticsearchQueryUtil.getSearchObject(cls, resolvedQuery);
    const result = await this.execSearch(cls, search);
    const all = await Promise.all(result.hits.hits.map(hit => this.#postLoad(cls, hit)));
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, all, (_, value) => value, query);
  }

  async suggestValuesByQuery<T extends ModelType>(
    cls: Class<T>,
    field: ValidStringFields<T>,
    prefix?: string,
    query?: SuggestModelQuery<T>
  ): Promise<string[]> {
    await QueryVerifier.verify(cls, query);

    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, {
      select: castTo({ [field]: 1 }),
      ...query
    });
    const search = ElasticsearchQueryUtil.getSearchObject(cls, resolvedQuery);
    const result = await this.execSearch(cls, search);
    const idSource = ModelRegistryIndex.getIdSource(cls);
    const all = result.hits.hits.map(hit => castTo<T>(field === idSource.field ? { [idSource.field]: hit._id } : hit._source));
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, all, item => item, query);
  }

  // Facet
  async facetByQuery<T extends ModelType>(
    cls: Class<T>,
    field: ValidStringFields<T>,
    query?: FacetModelQuery<T>
  ): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(cls, query);

    const resolvedSearch = ElasticsearchQueryUtil.getSearchObject(cls, query ?? {}, this.config.schemaConfig);
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 100;
    const size = offset + limit;

    const search: SearchRequest = {
      query: resolvedSearch.query ?? { match_all: {} },
      aggregations: { [field]: { terms: { field, size } } },
      size: 0
    };

    const result = await this.execSearch(cls, search);
    const { buckets } = castTo<AggregationsStringTermsAggregate>(
      'buckets' in result.aggregations![field] ? result.aggregations![field] : { buckets: [] }
    );
    const out = Array.isArray(buckets)
      ? buckets.slice(offset, size).map(bucket => ({ key: bucket.key!.toString(), count: bucket.doc_count }))
      : [];
    return out;
  }

  // Aggregate
  async aggregateFieldByQuery<T extends ModelType, const F extends ValidComparableFields<T>>(
    modelClass: Class<T>,
    field: F,
    query?: ModelQuery<T>
  ): Promise<FieldAggregateResult<T, F>> {
    await QueryVerifier.verify(modelClass, query);

    const search = ElasticsearchQueryUtil.getFieldAggregateSearchObject(modelClass, field, query, this.config.schemaConfig);

    const result = await this.execSearch(modelClass, search);
    const statsResult = result.aggregations?.field_aggregate as NumberFieldAggregateResult | undefined;

    return ModelQueryAggregateUtil.resolveAggregate(modelClass, field, statsResult ?? {});
  }
}
