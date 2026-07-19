import type { default as pg } from 'pg';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  type BulkOperation,
  type BulkResponse,
  type ModelBulkSupport,
  ModelBulkUtil,
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
import { type Class, castTo, JSONUtil } from '@travetto/runtime';

import { type PostgresJsonConnection, Transactional } from './connection.ts';
import { PostgresJsonQueryCompiler } from './query.ts';
import { PostgresJsonTableManager } from './table-manager.ts';
import { PostgresJsonUtil, type TableContext } from './util.ts';

/**
 * A PostgreSQL JSON-based document store model service
 */
@Injectable()
export class PostgresJsonModelService
  implements
    ModelCrudSupport,
    ModelStorageSupport,
    ModelBulkSupport,
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

  #getContext<T extends ModelType>(modelClass: Class<T>): TableContext<T> {
    return PostgresJsonUtil.getContext(modelClass, this.connection.config.namespace);
  }

  #compilePartialUpdate<T extends ModelType>(context: TableContext<T>, preparedData: Partial<T>): { sets: string[]; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [fieldName, val] of Object.entries(preparedData)) {
      const simpleField = context.simpleFields.get(fieldName);
      if (simpleField) {
        sets.push(`${PostgresJsonUtil.escapeIdentifier(fieldName)} = $${values.length + 1}`);
        values.push(val === undefined || val === null ? null : val);
        continue;
      }

      const complexField = context.complexFields.get(fieldName);
      if (complexField) {
        sets.push(`${PostgresJsonUtil.escapeIdentifier(fieldName)} = $${values.length + 1}`);
        values.push(val !== undefined && val !== null ? JSONUtil.toUTF8(val) : null);
      }
    }
    return { sets, values };
  }

  async #executeUpdatePartial<T extends ModelType>(
    modelClass: Class<T>,
    where: WhereClause<T>,
    data: Partial<T>,
    returning: boolean,
    view?: string
  ): Promise<{ count: number; records: Record<string, unknown>[] }> {
    const preparedData = await ModelCrudUtil.prePartialUpdate(modelClass, data, view);

    const context = this.#getContext(modelClass);
    const { sets, values } = this.#compilePartialUpdate(context, preparedData);
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, where);

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = whereSQL.replaceAll(/[$](\d+)/g, (_, num) => `$${Number(num) + offset}`);
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} SET ${sets.join(', ')} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}${returning ? ' RETURNING *' : ''};`;

    return await this.connection.execute<Record<string, unknown>>(sql, values);
  }

  async #executeUpdate<T extends ModelType>(modelClass: Class<T>, where: WhereClause<T>, item: T): Promise<T | undefined> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem: Record<string, unknown> = castTo(preppedItem);

    const context = this.#getContext(modelClass);
    const sets: string[] = [];
    const values: unknown[] = [];

    // Compile sets for all simple fields (excluding id)
    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    // Compile sets for all complex fields
    for (const field of context.complexFields.values()) {
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    // Compile where conditions
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, where);

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = whereSQL.replaceAll(/[$](\d+)/g, (_, num) => `$${Number(num) + offset}`);
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`;

    const result = await this.connection.execute(sql, values);
    if (result.count === 0) {
      return undefined;
    }
    if (result.count > 1) {
      throw new Error(`Multiple items found for update lookup ${modelClass.name}`);
    }
    return preppedItem;
  }

  #validateIndexResult<T extends ModelType>(
    result: { count: number },
    modelClass: Class<T>,
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

  async #loadSingle<T extends ModelType>(modelClass: Class<T>, record: Record<string, unknown>): Promise<T> {
    return await ModelCrudUtil.load(modelClass, record);
  }

  async #loadMany<T extends ModelType>(modelClass: Class<T>, records: unknown[]): Promise<T[]> {
    return await Promise.all(records.map(row => ModelCrudUtil.load(modelClass, castTo(row))));
  }

  async #executeUpsert<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>, conflictTarget: string[]): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const context = this.#getContext(modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];
    const updates: string[] = [];

    for (const field of context.simpleFields.values()) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
      if (field.name !== 'id') {
        updates.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = EXCLUDED.${PostgresJsonUtil.escapeIdentifier(field.name)}`);
      }
    }

    for (const field of context.complexFields.values()) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
      updates.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = EXCLUDED.${PostgresJsonUtil.escapeIdentifier(field.name)}`);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const sql = `
      INSERT INTO ${PostgresJsonUtil.escapeIdentifier(context.tableName)} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (${conflictTarget.join(', ')})
      DO UPDATE SET ${updates.join(', ')}
      RETURNING *;
    `;

    const result = await this.connection.execute<Record<string, unknown>>(sql, values);
    return this.#loadSingle(modelClass, result.records[0]);
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
    const { tableName } = this.#getContext(modelClass);
    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} WHERE "id" = $1;`;

    const result = await this.connection.execute<Record<string, unknown>>(sql, [id]);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }

    return this.#loadSingle(modelClass, result.records[0]);
  }

  async create<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>): Promise<T> {
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const context = this.#getContext(modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      columns.push(PostgresJsonUtil.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const sql = `INSERT INTO ${PostgresJsonUtil.escapeIdentifier(context.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`;

    await this.connection.execute(sql, values);
    return preppedItem;
  }

  async update<T extends ModelType>(modelClass: Class<T>, item: T): Promise<T> {
    const preppedItem = await this.#executeUpdate(modelClass, castTo({ id: item.id }), item);
    if (!preppedItem) {
      throw new NotFoundError(modelClass, item.id);
    }
    return preppedItem;
  }

  async upsert<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>): Promise<T> {
    return this.#executeUpsert(modelClass, item, [PostgresJsonUtil.escapeIdentifier('id')]);
  }

  async updatePartial<T extends ModelType>(modelClass: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);

    const result = await this.#executeUpdatePartial(modelClass, castTo({ id: item.id }), item, true, view);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, item.id);
    }

    return this.#loadSingle(modelClass, result.records[0]);
  }

  async delete<T extends ModelType>(modelClass: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const { tableName } = this.#getContext(modelClass);
    const sql = `DELETE FROM ${PostgresJsonUtil.escapeIdentifier(tableName)} WHERE ${PostgresJsonUtil.escapeIdentifier('id')} = $1;`;

    const result = await this.connection.execute(sql, [id]);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }
  }

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

    for (const op of preppedOps) {
      try {
        if ('insert' in op && op.insert) {
          await this.create(modelClass, op.insert);
          counts.insert++;
        } else if ('update' in op && op.update) {
          await this.update(modelClass, op.update);
          counts.update++;
        } else if ('upsert' in op && op.upsert) {
          await this.upsert(modelClass, op.upsert);
          counts.upsert++;
        } else if ('delete' in op && op.delete) {
          await this.delete(modelClass, op.delete.id);
          counts.delete++;
        }
      } catch (err) {
        counts.error++;
        errors.push(err);
      }
    }

    return {
      errors,
      insertedIds: addedIds,
      counts
    };
  }

  async *list<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    yield* this.listWithOffset(modelClass, options);
  }

  async *listWithOffset<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions & { offset?: number }): AsyncIterable<T[]> {
    const context = this.#getContext(modelClass);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compileWhere(context);

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} LIMIT ${batchLimit} OFFSET ${offset};`;

      const result = await this.connection.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await this.#loadMany(modelClass, result.records);
      yield items;
      produced += items.length;
      offset += items.length;
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

    const context = this.#getContext(modelClass);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compileWhere(context, where);
    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} WHERE ${whereSQL};`;

    const result = await this.connection.execute<Record<string, unknown>>(sql, parameters);
    this.#validateIndexResult(result, modelClass, indexConfig, computed);

    return this.#loadSingle(modelClass, result.records[0]);
  }

  async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const context = this.#getContext(modelClass);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compileWhere(context, where);
    const sql = `DELETE FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} WHERE ${whereSQL};`;

    const result = await this.connection.execute(sql, parameters);
    this.#validateIndexResult(result, modelClass, indexConfig, computed);
  }

  @Transactional()
  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
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

    const preppedItem = await this.#executeUpdate(modelClass, where, body);
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

    const result = await this.#executeUpdatePartial(modelClass, where, castTo(body), true);
    this.#validateIndexResult(result, modelClass, indexConfig, computed);

    return this.#loadSingle(modelClass, result.records[0]);
  }

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions & { offset?: number }
  ): AsyncIterable<T[]> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate();
    const where: WhereClause<T> = castTo(computed.project());

    const context = this.#getContext(modelClass);

    // Apply sorting template criteria
    const sortClauses = indexConfig.sortTemplate.map(({ path, value }) => {
      const expression = PostgresJsonTableManager.compileIndexPath(context.tableName, context.simpleFields, path);
      return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
    });
    const sortSQL = sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compileWhere(context, where);

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} LIMIT ${batchLimit} OFFSET ${offset};`;

      const result = await this.connection.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await this.#loadMany(modelClass, result.records);
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

    const context = this.#getContext(modelClass);
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, where);

    // Prefix matching on the first sort key segment
    const prefixFieldPath = indexConfig.sortTemplate[0].path;
    const { sqlPath } = PostgresJsonQueryCompiler.resolvePath(context, prefixFieldPath);

    // Postgres case insensitive ILIKE for prefix
    const placeholder = `$${parameters.length + 1}`;
    parameters.push(`${prefix}%`);

    const conditions = [`${sqlPath} ILIKE ${placeholder}`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} WHERE ${conditions.join(' AND ')} LIMIT ${options?.limit ?? 10};`;
    const result = await this.connection.execute(sql, parameters);

    return this.#loadMany(modelClass, result.records);
  }

  // Query Support
  async query<T extends ModelType>(modelClass: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(modelClass, query);
    const context = this.#getContext(modelClass);
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, query.where);
    const sortSQL = PostgresJsonQueryCompiler.compileSort(context, query.sort);

    let pagination = '';
    if (query.limit !== undefined) {
      pagination += ` LIMIT ${query.limit}`;
    }
    if (query.offset !== undefined) {
      pagination += ` OFFSET ${query.offset}`;
    }

    const sql = `SELECT * FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} ${pagination};`;
    const result = await this.connection.execute(sql, parameters);

    return this.#loadMany(modelClass, result.records);
  }

  async queryOne<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, failOnMany = true): Promise<T> {
    const limit = failOnMany ? 2 : 1;
    const items = await this.query<T>(modelClass, { ...query, limit });
    return ModelQueryUtil.verifyGetSingleCounts<T>(modelClass, failOnMany, items, query.where);
  }

  async queryCount<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const context = this.#getContext(modelClass);
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, query.where);
    const sql = `SELECT COUNT(*) as "total" FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

    const result = await this.connection.execute<{ total: string | number }>(sql, parameters);
    return Number(result.records[0]?.total ?? 0);
  }

  async updateByQuery<T extends ModelType>(modelClass: Class<T>, item: T, query: ModelQuery<T>): Promise<T> {
    await QueryVerifier.verify(modelClass, query);
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, this);
    const rawItem: Record<string, unknown> = castTo(preppedItem);

    const context = this.#getContext(modelClass);
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, query.where);

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      sets.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} = $${values.length + 1}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const conditions = [`${PostgresJsonUtil.escapeIdentifier('id')} = $${values.length + 1}`];
    values.push(preppedItem.id);

    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = whereSQL.replaceAll(/[$](\d+)/g, (_, num) => `$${Number(num) + offset}`);
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')};`;

    const result = await this.connection.execute(sql, values);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, `Query: ${JSONUtil.toUTF8(query.where)}`);
    }

    return preppedItem;
  }

  async updatePartialByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const result = await this.#executeUpdatePartial(modelClass, query.where!, data, false);
    return result.count;
  }

  async deleteByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const context = this.#getContext(modelClass);
    const { whereSQL, parameters = [] } = PostgresJsonQueryCompiler.compileWhere(context, query.where, false);

    const sql = `DELETE FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

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
    const context = this.#getContext(modelClass);
    const { whereSQL, parameters } = PostgresJsonQueryCompiler.compileWhere(context, query?.where);
    const { sqlPath } = PostgresJsonQueryCompiler.resolvePath(context, String(field).split('.'));

    const conditions = [`${sqlPath} IS NOT NULL`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `
      SELECT ${sqlPath}::text AS ${PostgresJsonUtil.escapeIdentifier('key')}, COUNT(*)::int AS ${PostgresJsonUtil.escapeIdentifier('count')}
      FROM ${PostgresJsonUtil.escapeIdentifier(context.tableName)}
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
