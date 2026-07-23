import { Injectable } from '@travetto/di';
import {
  type BulkOperation,
  type BulkResponse,
  type IndexConfig,
  type ModelBulkSupport,
  ModelBulkUtil,
  type ModelCrudProvider,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelExpirySupport,
  ModelExpiryUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  type ModelType,
  NotFoundError,
  type OptionalId
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
  type SortedIndexSelection,
  type SortedIndexSelectionType,
  warnIfIndexedUniqueIndex,
  warnIfNonIndexedIndex
} from '@travetto/model-indexed';
import {
  type ModelQuery,
  type ModelQueryCrudSupport,
  ModelQueryCrudUtil,
  type ModelQueryFacet,
  type ModelQueryFacetSupport,
  type ModelQuerySuggestSupport,
  ModelQuerySuggestUtil,
  type ModelQuerySupport,
  ModelQueryUtil,
  type PageableModelQuery,
  QueryVerifier,
  type ValidStringFields,
  type WhereClause
} from '@travetto/model-query';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import type { SQLConnection } from './connection.ts';
import type { AbstractANSI99Dialect } from './dialect.ts';
import { SQLModelSchemaUtil } from './schema.ts';
import type { TableContext } from './types.ts';

/**
 * Base SQL Model Service.
 * Implements CRUD, Query, Expiry, Bulk, Indexed, and Suggest operations
 * by delegating to connection and dialect components.
 */
@Injectable()
export abstract class BaseSQLModelService<C = unknown>
  implements
    ModelCrudSupport,
    ModelStorageSupport,
    ModelBulkSupport,
    ModelExpirySupport,
    ModelIndexedSupport,
    ModelQuerySupport,
    ModelQueryCrudSupport,
    ModelQueryFacetSupport,
    ModelQuerySuggestSupport
{
  abstract readonly client: C;
  abstract connection: SQLConnection;

  idSource = ModelCrudUtil.uuidSource();

  get dialect(): AbstractANSI99Dialect {
    return this.connection.dialect;
  }

  #whereClause<T extends ModelType>(
    modelClass: Class<T>,
    where?: WhereClause<T>,
    checkExpiry?: boolean
  ): { whereSQL?: string; parameters?: unknown[] } {
    return this.dialect.compileWhere(this.connection.getContext(modelClass), ModelQueryUtil.getWhereClause(modelClass, where), checkExpiry);
  }

  async initialize(): Promise<void> {
    await this.connection.init();
    await this.createStorage();
    ModelExpiryUtil.registerCull(this);
  }

  // Record Deserialization Helpers
  async loadSingle<T extends ModelType>(modelClass: Class<T>, record: Record<string, unknown>): Promise<T> {
    const schemaContext = SQLModelSchemaUtil.getSchemaContext(modelClass);
    const resolvedRecord = { ...record };
    for (const complexFieldName of schemaContext.complexFields.keys()) {
      const value = resolvedRecord[complexFieldName];
      if (typeof value === 'string') {
        resolvedRecord[complexFieldName] = JSONUtil.fromUTF8(value);
      }
    }
    return ModelCrudUtil.load(modelClass, resolvedRecord);
  }

  async loadMany<T extends ModelType>(modelClass: Class<T>, records: unknown[]): Promise<T[]> {
    return Promise.all(records.map(row => this.loadSingle(modelClass, castTo(row))));
  }

  async executeUpdatePartial<T extends ModelType>(
    modelClass: Class<T>,
    where: WhereClause<T>,
    data: Partial<T>,
    returning: boolean,
    view?: string
  ): Promise<{ count: number; records: Record<string, unknown>[] }> {
    const preparedData = await ModelCrudUtil.prePartialUpdate(modelClass, data, view);

    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, where);
    const { sql, values } = this.dialect.buildPartialUpdate(tableContext, preparedData, whereSQL, parameters, returning);

    const result = await this.connection.execute<Record<string, unknown>>(sql, values);

    if (result.count > 0 && returning && !this.dialect.returningSupport) {
      const selectSQL = this.dialect.buildSelect(tableContext, { whereSQL });
      const selectResult = await this.connection.execute<Record<string, unknown>>(selectSQL, parameters);
      return { count: result.count, records: selectResult.records };
    }

    return result;
  }

  async executeUpdate<T extends ModelType>(
    modelClass: Class<T>,
    where: WhereClause<T>,
    item: T,
    modelSource?: ModelCrudProvider
  ): Promise<T | undefined> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: this.idSource });
    const rawItem: Record<string, unknown> = castTo(preppedItem);

    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, where);
    const { sql, values } = this.dialect.buildUpdate(tableContext, rawItem, whereSQL, parameters);

    const result = await this.connection.execute(sql, values);
    if (result.count === 0) {
      return undefined;
    }
    if (result.count > 1) {
      throw new Error(`Multiple items found for update lookup ${modelClass.name}`);
    }
    return preppedItem;
  }

  async executeUpsert<T extends ModelType>(
    modelClass: Class<T>,
    item: OptionalId<T>,
    conflictTarget: string[],
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: this.idSource });
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const tableContext = this.connection.getContext(modelClass);

    const { sql, values } = this.dialect.buildUpsert(tableContext, rawItem, conflictTarget);

    const result = await this.connection.execute<Record<string, unknown>>(sql, values);
    if (result.records.length > 0) {
      return this.loadSingle(modelClass, result.records[0]);
    } else {
      return this.get(modelClass, rawItem.id as string);
    }
  }

  // Crud Support
  async get<T extends ModelType>(modelClass: Class<T>, id: string): Promise<T> {
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, castTo({ id }));
    const sql = this.dialect.buildSelect(tableContext, { whereSQL });

    const result = await this.connection.execute<Record<string, unknown>>(sql, parameters);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }

    return this.loadSingle(modelClass, result.records[0]);
  }

  async create<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>, modelSource?: ModelCrudProvider): Promise<T> {
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: this.idSource });
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const tableContext = this.connection.getContext(modelClass);

    const { sql, values } = this.dialect.buildInsert(tableContext, rawItem);

    await this.connection.execute(sql, values);
    return preppedItem;
  }

  async update<T extends ModelType>(modelClass: Class<T>, item: T, modelSource?: ModelCrudProvider): Promise<T> {
    const preppedItem = await this.executeUpdate(modelClass, castTo({ id: item.id }), item, modelSource);
    if (!preppedItem) {
      throw new NotFoundError(modelClass, item.id);
    }
    return preppedItem;
  }

  async upsert<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>, modelSource?: ModelCrudProvider): Promise<T> {
    return this.executeUpsert(modelClass, item, [this.dialect.escapeIdentifier('id')], modelSource);
  }

  async updatePartial<T extends ModelType>(modelClass: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);

    const result = await this.executeUpdatePartial(modelClass, castTo({ id: item.id }), item, true, view);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, item.id);
    }

    return this.loadSingle(modelClass, result.records[0]);
  }

  async delete<T extends ModelType>(modelClass: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, castTo({ id }), false);
    const sql = this.dialect.buildDelete(tableContext, whereSQL);

    const result = await this.connection.execute(sql, parameters);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }
  }

  async *list<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    yield* this.listWithOffset(modelClass, options);
  }

  async *listWithOffset<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions & { offset?: number }): AsyncIterable<T[]> {
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, undefined);

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = this.dialect.buildSelect(tableContext, { whereSQL, limit: batchLimit, offset });

      const result = await this.connection.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await this.loadMany(modelClass, result.records);
      yield items;
      produced += items.length;
      offset += items.length;
    }
  }

  async dropIndex<T extends ModelType>(tableContext: TableContext<T>, indexName: string): Promise<void> {
    const sql = this.dialect.getDropIndexSQL(tableContext, indexName);
    await this.connection.execute(sql);
  }

  async dropTable<T extends ModelType>(tableContext: TableContext<T>): Promise<void> {
    const sql = this.dialect.getDropTableSQL(tableContext);
    await this.connection.execute(sql);
  }

  async truncateTable<T extends ModelType>(tableContext: TableContext<T>): Promise<void> {
    const sql = this.dialect.getTruncateTableSQL(tableContext);
    await this.connection.execute(sql);
  }

  async upsertTable<T extends ModelType>(tableContext: TableContext<T>): Promise<void> {
    // Storage & Migration Operations
    const query = this.dialect.getTableExistsQuery(tableContext);
    const result = await this.connection.execute(query.sql, query.parameters);
    const tableExists = this.dialect.parseTableExistsResult(result.records);

    if (!tableExists) {
      const createTableSQL = this.dialect.getCreateTableSQL(tableContext);
      await this.connection.execute(createTableSQL);

      for (const createIndexSQL of this.dialect.getCreateTableIndexSQLs(tableContext)) {
        await this.connection.execute(createIndexSQL);
      }
    } else {
      const query = this.dialect.getExistingColumnsQuery(tableContext);
      const result = await this.connection.execute(query.sql, query.parameters);
      const existingColumns = this.dialect.parseExistingColumns(result.records);

      const requestedFieldsMap = new Map<string, string>();
      for (const field of tableContext.simpleFields.values()) {
        requestedFieldsMap.set(field.name, this.dialect.getColumnType(field));
      }
      for (const field of tableContext.complexFields.values()) {
        requestedFieldsMap.set(field.name, this.dialect.complexColumnType);
      }

      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = this.dialect.getAddColumnSQL(tableContext, columnName, columnType);
          await this.connection.execute(addColumnSQL);
        } else if (this.dialect.getAlterColumnTypeSQL) {
          const existingType = existingColumns.get(columnName)!;
          const alterColumnSQL = this.dialect.getAlterColumnTypeSQL(tableContext, columnName, columnType, existingType);
          if (alterColumnSQL) {
            await this.connection.execute(alterColumnSQL);
          }
        }
      }

      const indexQuery = this.dialect.getExistingIndexesQuery(tableContext);
      const indexResult = await this.connection.execute(indexQuery.sql, indexQuery.parameters);
      const existingIndexes = this.dialect.parseExistingIndexes(indexResult.records);

      const modelIndexes = ModelRegistryIndex.getIndices(tableContext.cls) || [];

      const definedIndexes = new Map<string, IndexConfig>();
      for (const indexConfig of modelIndexes) {
        const indexName = ['idx', tableContext.tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');
        definedIndexes.set(indexName, indexConfig);
      }

      for (const [indexName, indexDefinition] of existingIndexes.entries()) {
        if (!definedIndexes.has(indexName)) {
          await this.dropIndex(tableContext, indexName);
        } else {
          const indexConfig = definedIndexes.get(indexName)!;
          const expectedSQL = this.dialect.getCreateIndexSQL(tableContext, indexConfig);

          if (indexDefinition) {
            const normalizedExisting = this.dialect.normalizeIndexDefinition(indexDefinition);
            const normalizedExpected = this.dialect.normalizeIndexDefinition(expectedSQL);

            if (normalizedExisting !== normalizedExpected) {
              await this.dropIndex(tableContext, indexName);
              await this.connection.execute(expectedSQL);
            }
          }
        }
      }

      for (const [indexName, indexConfig] of definedIndexes.entries()) {
        if (!existingIndexes.has(indexName)) {
          const createIndexSQL = this.dialect.getCreateIndexSQL(tableContext, indexConfig);
          await this.connection.execute(createIndexSQL);
        }
      }
    }
  }

  // Storage Support
  async createStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      warnIfNonIndexedIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      const tableContext = this.connection.getContext(modelClass);
      await this.upsertTable(tableContext);
    }
  }

  async deleteStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      const tableContext = this.connection.getContext(modelClass);
      await this.dropTable(tableContext);
    }
  }

  async deleteModel(modelClass: Class): Promise<void> {
    const tableContext = this.connection.getContext(modelClass);
    await this.dropTable(tableContext);
  }

  async upsertModel(modelClass: Class): Promise<void> {
    const tableContext = this.connection.getContext(modelClass);
    await this.upsertTable(tableContext);
  }

  async truncateModel<T extends ModelType>(modelClass: Class<T>): Promise<void> {
    const tableContext = this.connection.getContext(modelClass);
    await this.truncateTable(tableContext);
  }

  // Bulk Support
  async processBulk<T extends ModelType>(modelClass: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse> {
    const { insertedIds, upsertedIds, operations: preppedOps } = await ModelBulkUtil.preStore(modelClass, operations, this);

    const addedIds = new Map([...insertedIds.entries(), ...upsertedIds.entries()]);

    const counts = {
      update: 0,
      insert: 0,
      upsert: 0,
      delete: 0,
      error: 0
    };
    const errors: unknown[] = [];

    await WorkPool.run(
      async operation => {
        try {
          if ('insert' in operation && operation.insert) {
            await this.create(modelClass, operation.insert);
            counts.insert++;
          } else if ('update' in operation && operation.update) {
            await this.update(modelClass, operation.update);
            counts.update++;
          } else if ('upsert' in operation && operation.upsert) {
            await this.upsert(modelClass, operation.upsert);
            counts.upsert++;
          } else if ('delete' in operation && operation.delete) {
            await this.delete(modelClass, operation.delete.id);
            counts.delete++;
          }
        } catch (err) {
          counts.error++;
          errors.push(err);
        }
      },
      preppedOps,
      { max: 8 }
    );

    return {
      errors,
      insertedIds: addedIds,
      counts
    };
  }

  // Expiry Support
  async deleteExpired<T extends ModelType>(modelClass: Class<T>): Promise<number> {
    return ModelQueryCrudUtil.deleteExpired(this, modelClass);
  }

  // Indexed Support
  validateIndexResult<T extends ModelType>(
    modelClass: Class<T>,
    result: { count: number },
    indexConfig: SingleItemIndex<T>,
    computed: ModelIndexedComputedIndex<T>
  ): void {
    if (result.count === 0) {
      throw new NotFoundError(`${modelClass.name} Index=${indexConfig}`, computed.getKey());
    }
    if (result.count > 1) {
      throw new Error(`Multiple items found for index lookup ${modelClass.name} Index=${indexConfig}`);
    }
  }

  async getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, where);
    const sql = this.dialect.buildSelect(tableContext, { whereSQL });

    const result = await this.connection.execute<Record<string, unknown>>(sql, parameters);
    this.validateIndexResult(modelClass, result, indexConfig, computed);

    return this.loadSingle(modelClass, result.records[0]);
  }

  async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, where);
    const sql = this.dialect.buildDelete(tableContext, whereSQL);

    const result = await this.connection.execute(sql, parameters);
    this.validateIndexResult(modelClass, result, indexConfig, computed);
  }

  async upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, modelClass, indexConfig, body);
  }

  async updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: T
  ): Promise<T> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, castTo(body)).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const preppedItem = await this.executeUpdate(modelClass, where, body, this);
    if (!preppedItem) {
      throw new NotFoundError(`${modelClass.name} Index=${indexConfig}`, computed.getKey());
    }
    return preppedItem;
  }

  async updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);

    const computed = ModelIndexedComputedIndex.get(indexConfig, castTo(body)).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const result = await this.executeUpdatePartial(modelClass, where, castTo(body), true);
    this.validateIndexResult(modelClass, result, indexConfig, computed);

    return this.loadSingle(modelClass, result.records[0]);
  }

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions & { offset?: number }
  ): AsyncIterable<T[]> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate();
    const where: WhereClause<T> = castTo(computed.project());

    const tableContext = this.connection.getContext(modelClass);
    const sortSQL = this.dialect.buildIndexSort(tableContext, indexConfig);

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    const { whereSQL, parameters } = this.#whereClause(modelClass, where);

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = this.dialect.buildSelect(tableContext, { whereSQL, sortSQL, limit: batchLimit, offset });

      const result = await this.connection.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await this.loadMany(modelClass, result.records);
      yield items;
      produced += items.length;
      offset += items.length;
    }
  }

  async pageByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions
  ): Promise<ModelPageResult<T>> {
    const listOptions = {
      limit: options?.limit,
      offset: options?.offset ? Number(options.offset) : 0
    };

    const items: T[] = [];
    let nextOffset = listOptions.offset ?? 0;

    for await (const batch of this.listByIndex(modelClass, indexConfig, body, listOptions)) {
      items.push(...batch);
      nextOffset += batch.length;
    }

    return {
      items,
      nextOffset: items.length === options?.limit ? String(nextOffset) : undefined
    };
  }

  async suggestByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
    B extends SortedIndexSelectionType<T, S> & string
  >(
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    prefix: B,
    options?: ModelIndexedSearchOptions
  ): Promise<T[]> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate();
    const where: WhereClause<T> = castTo(computed.project());

    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, where);

    const prefixFieldPath = indexConfig.sortTemplate[0].path;
    const { sqlPath } = this.dialect.resolvePath(tableContext, prefixFieldPath, 'read');

    const placeholder = this.dialect.getPlaceholder(parameters.length + 1);
    parameters.push(`${prefix}%`);

    const likeOp = this.dialect.suggestLikeOperator ?? 'LIKE';
    const conditions = [`${sqlPath} ${likeOp} ${placeholder}`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = this.dialect.buildSelect(tableContext, { whereSQL: conditions.join(' AND '), limit: options?.limit ?? 10 });
    const result = await this.connection.execute(sql, parameters);

    return this.loadMany(modelClass, result.records);
  }

  // Query Support
  async query<T extends ModelType>(modelClass: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(modelClass, query);
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where);
    const sortSQL = this.dialect.compileSort(tableContext, query.sort);

    const sql = this.dialect.buildSelect(tableContext, {
      whereSQL,
      sortSQL,
      limit: query.limit,
      offset: query.offset
    });
    const result = await this.connection.execute(sql, parameters);

    return this.loadMany(modelClass, result.records);
  }

  async queryOne<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, failOnMany = true): Promise<T> {
    const limit = failOnMany ? 2 : 1;
    const items = await this.query<T>(modelClass, { ...query, limit });
    return ModelQueryUtil.verifyGetSingleCounts<T>(modelClass, failOnMany, items, query.where);
  }

  async queryCount<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where);
    const sql = this.dialect.buildCount(tableContext, whereSQL);

    const result = await this.connection.execute<{ total: string | number }>(sql, parameters);
    return Number(result.records[0]?.total ?? 0);
  }

  // Query Crud Support
  async updateByQuery<T extends ModelType>(
    modelClass: Class<T>,
    item: T,
    query: ModelQuery<T>,
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    await QueryVerifier.verify(modelClass, query);
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: this.idSource });
    const rawItem: Record<string, unknown> = castTo(preppedItem);

    const tableContext = this.connection.getContext(modelClass);
    const combinedWhere: WhereClause<T> = castTo({
      $and: [{ id: preppedItem.id }, ...(query.where ? [query.where] : [])]
    });
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, combinedWhere);

    const { sql, values } = this.dialect.buildUpdate(tableContext, rawItem, whereSQL, parameters);

    const result = await this.connection.execute(sql, values);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, `Query: ${JSONUtil.toUTF8(query.where)}`);
    }

    return preppedItem;
  }

  async updatePartialByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const result = await this.executeUpdatePartial(modelClass, query.where!, data, false);
    return result.count;
  }

  async deleteByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where, false);

    const sql = this.dialect.buildDelete(tableContext, whereSQL);

    const result = await this.connection.execute(sql, parameters);
    return result.count;
  }

  // Suggest Support
  async suggestValuesByQuery<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    prefix?: string,
    query?: PageableModelQuery<T>
  ): Promise<string[]> {
    const resolvedQuery = ModelQuerySuggestUtil.getSuggestFieldQuery<T>(modelClass, field, prefix, query);
    const results = await this.query<T>(modelClass, resolvedQuery);
    return ModelQuerySuggestUtil.combineSuggestResults<T, string>(modelClass, field, prefix, results, value => value, query?.limit);
  }

  async suggestByQuery<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    prefix?: string,
    query?: PageableModelQuery<T>
  ): Promise<T[]> {
    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(modelClass, field, prefix, query);
    const results = await this.query<T>(modelClass, resolvedQuery);
    return ModelQuerySuggestUtil.combineSuggestResults<T, T>(modelClass, field, prefix, results, (_, value) => value, query?.limit);
  }

  // Facet Support
  async facetByQuery<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    query?: ModelQuery<T>
  ): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(modelClass, query);
    const tableContext = this.connection.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, query?.where);
    const { sqlPath } = this.dialect.resolvePath(tableContext, String(field).split('.'), 'read');

    const sql = this.dialect.buildFacet(tableContext, sqlPath, whereSQL);

    const result = await this.connection.execute<{ key: string; count: string | number }>(sql, parameters);

    return result.records.map(record => ({
      key: record.key,
      count: Number(record.count)
    }));
  }
}
