import type { default as pg } from 'pg';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  type ModelCrudSupport,
  ModelCrudUtil,
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
import { type Class, castTo } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { PostgresJsonConnection } from './connection.ts';
import { PostgresJsonQueryCompiler } from './query.ts';
import { PostgresJsonTableManager } from './table-manager.ts';
import { PostgresJsonUtil } from './util.ts';

/**
 * A PostgreSQL JSON-based document store model service
 */
@Injectable()
export class PostgresJsonModelService
  implements
    ModelCrudSupport,
    ModelStorageSupport,
    ModelIndexedSupport,
    ModelQuerySupport,
    ModelQueryCrudSupport,
    ModelQueryFacetSupport,
    ModelQuerySuggestSupport
{
  idSource = ModelCrudUtil.uuidSource();
  connection: PostgresJsonConnection;
  #tableManager: PostgresJsonTableManager;

  constructor(connection: PostgresJsonConnection) {
    this.connection = connection;
    this.#tableManager = new PostgresJsonTableManager(connection);
  }

  get client(): pg.Pool {
    return this.connection.pool;
  }

  @PostConstruct()
  async initialize(): Promise<void> {
    await this.connection.init();
    await this.createStorage();
  }

  // Storage Support
  async createStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      warnIfNonIndexedIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      await this.#tableManager.upsertTable(modelClass, this.connection.config.namespace);
    }
  }

  async deleteStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      await this.#tableManager.dropTable(modelClass, this.connection.config.namespace);
    }
  }

  async deleteModel<T extends ModelType>(modelClass: Class<T>): Promise<void> {
    await this.#tableManager.dropTable(modelClass, this.connection.config.namespace);
  }

  async upsertModel(modelClass: Class): Promise<void> {
    await this.#tableManager.upsertTable(modelClass, this.connection.config.namespace);
  }

  // CRUD Support
  async get<T extends ModelType>(modelClass: Class<T>, id: string): Promise<T> {
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} WHERE "id" = $1;`;

    const result = await this.connection.execute<Record<string, unknown>>(sql, [id]);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }

    return await ModelCrudUtil.load(modelClass, result.records[0]);
  }

  async create<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>): Promise<T> {
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem = castTo<any>(preppedItem);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const classification = PostgresJsonUtil.classifyFields(modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of classification.simpleFields) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of classification.complexFields) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSON.stringify(value) : null);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const sql = `INSERT INTO ${PostgresJsonUtil.escapeIdentifier(tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`;

    await this.connection.execute(sql, values);
    return preppedItem;
  }

  async update<T extends ModelType>(modelClass: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem = castTo<any>(preppedItem);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const classification = PostgresJsonUtil.classifyFields(modelClass);

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of classification.simpleFields) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of classification.complexFields) {
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSON.stringify(value) : null);
    }

    values.push(preppedItem.id);
    const sql = `UPDATE ${PostgresJsonUtil.escapeIdentifier(tableName)} SET ${sets.join(', ')} WHERE ${PostgresJsonUtil.escapeIdentifier('id')} = $${values.length};`;

    const result = await this.connection.execute(sql, values);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, preppedItem.id);
    }

    return preppedItem;
  }

  async upsert<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem = castTo<any>(preppedItem);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const classification = PostgresJsonUtil.classifyFields(modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];
    const updates: string[] = [];

    for (const field of classification.simpleFields) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
      if (field.name !== 'id') {
        updates.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = EXCLUDED.${PostgresJsonUtil.escapeIdentifier(field.name)}`);
      }
    }

    for (const field of classification.complexFields) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSON.stringify(value) : null);
      updates.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = EXCLUDED.${PostgresJsonUtil.escapeIdentifier(field.name)}`);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const sql = `
      INSERT INTO ${PostgresJsonUtil.escapeIdentifier(tableName)} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (${PostgresJsonUtil.escapeIdentifier('id')})
      DO UPDATE SET ${updates.join(', ')};
    `;

    await this.connection.execute(sql, values);
    return preppedItem;
  }

  async updatePartial<T extends ModelType>(modelClass: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const fullItem = await ModelCrudUtil.naivePartialUpdate(modelClass, () => this.get(modelClass, item.id), item, view);
    return this.update(modelClass, fullItem);
  }

  async delete<T extends ModelType>(modelClass: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const sql = `DELETE FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} WHERE ${PostgresJsonUtil.escapeIdentifier('id')} = $1;`;

    const result = await this.connection.execute(sql, [id]);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }
  }

  async *list<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    yield* this.listWithOffset(modelClass, options);
  }

  async *listWithOffset<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions & { offset?: number }): AsyncIterable<T[]> {
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, undefined, tableName);

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} LIMIT ${batchLimit} OFFSET ${offset};`;

      const result = await this.connection.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await Promise.all(result.records.map(row => ModelCrudUtil.load(modelClass, castTo(row))));
      yield items;
      produced += items.length;
      offset += items.length;
    }
  }

  // Indexed Support
  async #getIdByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<string> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate({ sort: true });
    const where = castTo<WhereClause<T>>(computed.project({ sort: true, includeId: true }));

    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, where, tableName);
    const sql = `SELECT "id" FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} WHERE ${whereSQL};`;

    const result = await this.connection.execute<{ id: string }>(sql, parameters);
    if (result.count === 0) {
      throw new NotFoundError(`${modelClass.name} Index=${indexConfig}`, computed.getKey());
    }
    if (result.count > 1) {
      throw new Error(`Multiple items found for index lookup ${modelClass.name} Index=${indexConfig}`);
    }

    return result.records[0].id;
  }

  async getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    return this.get(modelClass, await this.#getIdByIndex(modelClass, indexConfig, body));
  }

  async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    return this.delete(modelClass, await this.#getIdByIndex(modelClass, indexConfig, body));
  }

  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, modelClass, indexConfig, body);
  }

  updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: T
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, modelClass, indexConfig, body);
  }

  async updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    const item = await ModelCrudUtil.naivePartialUpdate(
      modelClass,
      () => this.getByIndex(modelClass, indexConfig, castTo(body)),
      castTo(body)
    );
    return this.update(modelClass, item);
  }

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions & { offset?: number }
  ): AsyncIterable<T[]> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate();
    const where = castTo<WhereClause<T>>(computed.project());

    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const classification = PostgresJsonUtil.classifyFields(modelClass);
    const simpleFieldsSet = new Set(classification.simpleFields.map(field => field.name));
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, where, tableName);

    // Apply sorting template criteria
    const sortClauses = indexConfig.sortTemplate.map(({ path, value }) => {
      const expression = PostgresJsonTableManager.compileIndexPath(tableName, simpleFieldsSet, path);
      return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
    });
    const sortSQL = sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} LIMIT ${batchLimit} OFFSET ${offset};`;

      const result = await this.connection.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await Promise.all(result.records.map(row => ModelCrudUtil.load(modelClass, castTo(row))));
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
    const where = castTo<WhereClause<T>>(computed.project());

    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, where, tableName);

    // Prefix matching on the first sort key segment
    const prefixFieldPath = indexConfig.sortTemplate[0].path;
    const { sqlPath } = PostgresJsonQueryCompiler.resolvePath(modelClass, prefixFieldPath);

    // Postgres case insensitive ILIKE for prefix
    const placeholder = `$${parameters.length + 1}`;
    parameters.push(`${prefix}%`);

    const conditions = [`${sqlPath} ILIKE ${placeholder}`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} WHERE ${conditions.join(' AND ')} LIMIT ${options?.limit ?? 10};`;
    const result = await this.connection.execute(sql, parameters);

    return Promise.all(result.records.map(row => ModelCrudUtil.load(modelClass, castTo(row))));
  }

  // Query Support
  async query<T extends ModelType>(modelClass: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(modelClass, query);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, query.where, tableName);
    const sortSQL = PostgresJsonQueryCompiler.compileSort(modelClass, query.sort);

    let pagination = '';
    if (query.limit !== undefined) {
      pagination += ` LIMIT ${query.limit}`;
    }
    if (query.offset !== undefined) {
      pagination += ` OFFSET ${query.offset}`;
    }

    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} ${pagination};`;
    const result = await this.connection.execute(sql, parameters);

    return Promise.all(result.records.map(row => ModelCrudUtil.load(modelClass, castTo(row))));
  }

  async queryOne<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, failOnMany = true): Promise<T> {
    const limit = failOnMany ? 2 : 1;
    const items = await this.query<T>(modelClass, { ...query, limit });
    return castTo<T>(ModelQueryUtil.verifyGetSingleCounts(modelClass, failOnMany, items, query.where));
  }

  async queryCount<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, query.where, tableName);
    const sql = `SELECT COUNT(*) as "total" FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

    const result = await this.connection.execute<{ total: string | number }>(sql, parameters);
    return Number(result.records[0]?.total ?? 0);
  }

  async updateByQuery<T extends ModelType>(modelClass: Class<T>, item: T, query: ModelQuery<T>): Promise<T> {
    await QueryVerifier.verify(modelClass, query);
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem = castTo<any>(preppedItem);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const classification = PostgresJsonUtil.classifyFields(modelClass);

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of classification.simpleFields) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of classification.complexFields) {
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSON.stringify(value) : null);
    }

    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, query.where, tableName);

    const conditions = [`${PostgresJsonUtil.escapeIdentifier('id')} = $${values.length + 1}`];
    values.push(preppedItem.id);

    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = whereSQL.replaceAll(/\$(\d+)/g, (_, num) => `$${Number(num) + offset}`);
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${PostgresJsonUtil.escapeIdentifier(tableName)} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')};`;

    const result = await this.connection.execute(sql, values);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, `Query: ${JSON.stringify(query.where)}`);
    }

    return preppedItem;
  }

  async updatePartialByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    let baseClass = modelClass;
    while (true) {
      const config = SchemaRegistryIndex.getOptional(baseClass)?.get();
      if (!config || config.discriminatedBase) {
        break;
      }
      const parent = Object.getPrototypeOf(baseClass);
      if (!parent || !SchemaRegistryIndex.has(parent)) {
        break;
      }
      baseClass = parent;
    }

    const items = await this.query(modelClass, query);
    for (const item of items) {
      const fullItem = await ModelCrudUtil.naivePartialUpdate(modelClass, () => Promise.resolve(item), data);
      await this.update(baseClass, fullItem);
    }
    return items.length;
  }

  async deleteByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, query.where, tableName, false);
    const sql = `DELETE FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

    const result = await this.connection.execute(sql, parameters);
    return result.count;
  }

  // Facet Support
  async facetByQuery<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    query?: ModelQuery<T>
  ): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(modelClass, query);
    const tableName = PostgresJsonTableManager.getTableName(modelClass, this.connection.config.namespace);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compile(modelClass, query?.where, tableName);
    const { sqlPath } = PostgresJsonQueryCompiler.resolvePath(modelClass, String(field).split('.'));

    const conditions = [`${sqlPath} IS NOT NULL`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `
      SELECT ${sqlPath}::text AS ${PostgresJsonUtil.escapeIdentifier('key')}, COUNT(*)::int AS ${PostgresJsonUtil.escapeIdentifier('count')}
      FROM ${PostgresJsonUtil.escapeIdentifier(tableName)}
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${sqlPath}
      ORDER BY ${PostgresJsonUtil.escapeIdentifier('count')} DESC;
    `;

    const result = await this.connection.execute<{ key: string; count: number }>(sql, parameters);

    return result.records;
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
    return ModelQuerySuggestUtil.combineSuggestResults(modelClass, field, prefix, results, (_, val) => val, query?.limit);
  }
}
