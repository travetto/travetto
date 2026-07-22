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
  isModelIndexedIndex,
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
  isModelQueryIndex,
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
import type { SchemaFieldConfig } from '@travetto/schema';
import { WorkPool } from '@travetto/worker';

import type { SQLConnection } from './connection.ts';
import { SQLQueryCompiler } from './query.ts';
import type { JSONSqlPathMode, SQLDialect, TableContext } from './types.ts';
import { SQLModelUtil } from './util.ts';

/**
 * Base SQL Model Service.
 * Implements CRUD, Query, Expiry, Bulk, Indexed, and Suggest operations
 * by delegating to connection and dialect methods.
 */
export abstract class BaseSQLModelService
  implements
    ModelCrudSupport,
    ModelStorageSupport,
    ModelBulkSupport,
    ModelExpirySupport,
    ModelIndexedSupport,
    ModelQuerySupport,
    ModelQueryCrudSupport,
    ModelQueryFacetSupport,
    ModelQuerySuggestSupport,
    SQLDialect
{
  abstract readonly client: unknown;
  abstract connection: SQLConnection;
  abstract returningSupport: boolean;

  idSource = ModelCrudUtil.uuidSource();
  suggestLikeOperator = 'LIKE';

  getContext<T extends ModelType>(modelClass: Class<T>): TableContext<T> {
    let tableName = ModelRegistryIndex.getStoreName(modelClass);
    if (this.connection.namespace) {
      tableName = `${this.connection.namespace}_${tableName}`;
    }

    const database = this.connection.database;

    return {
      tableName,
      database,
      escapedTableName: this.escapeIdentifier(tableName),
      dialect: this,
      ...SQLModelUtil.getSchemaContext(modelClass)
    };
  }

  #whereClause<T extends ModelType>(
    cls: Class<T>,
    where?: WhereClause<T>,
    checkExpiry?: boolean
  ): { whereSQL?: string; parameters?: unknown[] } {
    return SQLQueryCompiler.compileWhere(this.getContext(cls), ModelQueryUtil.getWhereClause(cls, where), checkExpiry);
  }

  // SQLDialect contract
  escapeIdentifier(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
  }

  escapeLiteral(value: string): string {
    return value.replaceAll("'", "''");
  }

  abstract getColumnType(fieldConfiguration: SchemaFieldConfig): string;
  abstract compileJsonIndexPath(columnName: string, jsonPath: string[], mode: JSONSqlPathMode): string;

  compileIndexPath(context: TableContext, path: string[], mode: JSONSqlPathMode): string {
    const firstSegment = path[0];
    const escapedFirst = this.escapeIdentifier(firstSegment);
    if (context.simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new Error(`Cannot create nested index under simple column "${firstSegment}" in table "${context.tableName}"`);
      }
      return escapedFirst;
    } else {
      const nestedSegments = path.slice(1);
      if (nestedSegments.length === 0) {
        return escapedFirst;
      }
      return this.compileJsonIndexPath(escapedFirst, nestedSegments, mode);
    }
  }

  getCreateIndexSQL(context: TableContext, indexConfig: IndexConfig): string {
    const { tableName, cls: modelClass } = context;
    const indexName = ['idx', tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');

    if (isModelQueryIndex(indexConfig)) {
      const indexFields = indexConfig.fields.map(field => {
        const fieldKey = Object.keys(field)[0];
        const sortDirection = castTo<Record<string, unknown>>(field)[fieldKey];
        const isAscending = typeof sortDirection === 'number' ? sortDirection === 1 : !sortDirection;

        const path = fieldKey.split('.');
        const expression = this.compileIndexPath(context, path, 'createIndex');
        return `${expression} ${isAscending ? 'ASC' : 'DESC'}`;
      });

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${context.escapedTableName} (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = this.compileIndexPath(context, path, 'createIndex');
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${context.escapedTableName} (${indexFields.join(', ')});`;
    }

    throw new Error(`Unsupported index configuration for class ${modelClass.name}`);
  }

  getPlaceholder(index: number): string {
    return '?';
  }

  abstract compileArrayContains(sqlPath: string, ident: string, isObject: boolean, type?: Class): string;
  abstract getRegexOperator(caseInsensitive: boolean): string;
  abstract formatRegex(source: string, caseInsensitive: boolean): string;
  abstract castColumn(sqlPath: string, type: Class): string;
  getUpsertSQL(context: TableContext, columns: string[], placeholders: string[], conflictTarget: string[], updates: string[]): string {
    return `INSERT INTO ${context.escapedTableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *;`;
  }

  normalizeIndexDefinition(sql: string): string {
    return sql
      .toLowerCase()
      .replaceAll('"', '')
      .replaceAll("'", '')
      .replaceAll(' ', '')
      .replaceAll('asc', '')
      .replaceAll('desc', '')
      .replaceAll('btree', '')
      .replaceAll('public.', '')
      .replaceAll('::text', '')
      .replaceAll('(', '')
      .replaceAll(')', '');
  }

  abstract complexColumnType: string;
  abstract getTableExists(context: TableContext): Promise<boolean>;
  abstract getExistingColumns(context: TableContext): Promise<Map<string, string>>;
  abstract getExistingIndexes(context: TableContext): Promise<Map<string, string>>;
  abstract dropIndex(context: TableContext, indexName: string): Promise<void>;

  handleColumnTypeMismatch?(context: TableContext, columnName: string, columnType: string, existingType: string): Promise<void>;

  async upsertTable(context: TableContext): Promise<void> {
    const tableExists = await this.getTableExists(context);

    if (!tableExists) {
      const idType = this.getColumnType(castTo({ name: 'id', type: String }));
      const columnDefinitions: string[] = [`${this.escapeIdentifier('id')} ${idType} PRIMARY KEY`];

      for (const field of context.simpleFields.values()) {
        if (field.name === 'id') {
          continue;
        }
        const columnType = this.getColumnType(field);
        columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${columnType}`);
      }

      for (const field of context.complexFields.values()) {
        columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${this.complexColumnType}`);
      }

      const createTableSQL = `CREATE TABLE ${context.escapedTableName} (\n  ${columnDefinitions.join(',\n  ')}\n);`;
      await this.connection.execute(createTableSQL);

      const indexes = ModelRegistryIndex.getIndices(context.cls) || [];
      for (const index of indexes) {
        const createIndexSQL = this.getCreateIndexSQL(context, index);
        await this.connection.execute(createIndexSQL);
      }
    } else {
      const existingColumns = await this.getExistingColumns(context);

      const requestedFieldsMap = new Map<string, string>();
      for (const field of context.simpleFields.values()) {
        requestedFieldsMap.set(field.name, this.getColumnType(field));
      }
      for (const field of context.complexFields.values()) {
        requestedFieldsMap.set(field.name, this.complexColumnType);
      }

      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = `ALTER TABLE ${context.escapedTableName} ADD COLUMN ${this.escapeIdentifier(columnName)} ${columnType};`;
          await this.connection.execute(addColumnSQL);
        } else {
          if (this.handleColumnTypeMismatch) {
            await this.handleColumnTypeMismatch(context, columnName, columnType, existingColumns.get(columnName)!);
          }
        }
      }

      for (const columnName of existingColumns.keys()) {
        if (columnName === 'id') {
          continue;
        }
        if (!requestedFieldsMap.has(columnName)) {
          const dropColumnSQL = `ALTER TABLE ${context.escapedTableName} DROP COLUMN ${this.escapeIdentifier(columnName)};`;
          await this.connection.execute(dropColumnSQL);
        }
      }

      const existingIndexes = await this.getExistingIndexes(context);
      const requestedIndexes = ModelRegistryIndex.getIndices(context.cls) || [];
      const requestedIndexesMap = new Map<string, IndexConfig>();

      for (const index of requestedIndexes) {
        const indexName = ['idx', context.tableName, index.name.toLowerCase().replaceAll('-', '_')].join('_');
        requestedIndexesMap.set(indexName, index);

        const newIndexSQL = this.getCreateIndexSQL(context, index);
        if (!existingIndexes.has(indexName)) {
          await this.connection.execute(newIndexSQL);
        } else {
          if (this.normalizeIndexDefinition) {
            const normalizedExisting = this.normalizeIndexDefinition(existingIndexes.get(indexName) ?? '');
            const normalizedRequested = this.normalizeIndexDefinition(newIndexSQL);

            if (normalizedExisting !== normalizedRequested) {
              await this.dropIndex(context, indexName);
              await this.connection.execute(newIndexSQL);
            }
          }
        }
      }

      for (const indexName of existingIndexes.keys()) {
        if (!requestedIndexesMap.has(indexName)) {
          await this.dropIndex(context, indexName);
        }
      }
    }
  }

  async dropTable(context: TableContext): Promise<void> {
    await this.connection.execute(`DROP TABLE IF EXISTS ${context.escapedTableName};`);
  }

  async truncateTable(context: TableContext): Promise<void> {
    await this.connection.execute(`TRUNCATE TABLE ${context.escapedTableName};`);
  }

  async initialize(): Promise<void> {
    await this.connection.init();
    await this.createStorage();
    ModelExpiryUtil.registerCull(this);
  }

  shiftPlaceholders?(sql: string, offset: number): string;

  // Record Deserialization Helpers
  async loadSingle<T extends ModelType>(modelClass: Class<T>, record: Record<string, unknown>): Promise<T> {
    const schemaContext = SQLModelUtil.getSchemaContext(modelClass);
    const resolvedRecord = { ...record };
    for (const complexFieldName of schemaContext.complexFields.keys()) {
      const val = resolvedRecord[complexFieldName];
      if (typeof val === 'string') {
        resolvedRecord[complexFieldName] = JSON.parse(val);
      }
    }
    return ModelCrudUtil.load(modelClass, resolvedRecord);
  }

  async loadMany<T extends ModelType>(modelClass: Class<T>, records: unknown[]): Promise<T[]> {
    return Promise.all(records.map(row => this.loadSingle(modelClass, castTo(row))));
  }

  // Update compilation helpers
  compilePartialUpdate<T extends ModelType>(context: TableContext<T>, preparedData: Partial<T>): { sets: string[]; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [fieldName, val] of Object.entries(preparedData)) {
      const simpleField = context.simpleFields.get(fieldName);
      if (simpleField) {
        sets.push(`${this.escapeIdentifier(fieldName)} = ${this.getPlaceholder(values.length + 1)}`);
        values.push(val === undefined || val === null ? null : val);
        continue;
      }

      const complexField = context.complexFields.get(fieldName);
      if (complexField) {
        sets.push(`${this.escapeIdentifier(fieldName)} = ${this.getPlaceholder(values.length + 1)}`);
        values.push(val !== undefined && val !== null ? JSONUtil.toUTF8(val) : null);
      }
    }
    return { sets, values };
  }

  async executeUpdatePartial<T extends ModelType>(
    modelClass: Class<T>,
    where: WhereClause<T>,
    data: Partial<T>,
    returning: boolean,
    view?: string
  ): Promise<{ count: number; records: Record<string, unknown>[] }> {
    const preparedData = await ModelCrudUtil.prePartialUpdate(modelClass, data, view);

    const context = this.getContext(modelClass);
    const { sets, values } = this.compilePartialUpdate(context, preparedData);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, where);

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = this.shiftPlaceholders ? this.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const useReturning = returning && this.returningSupport;
    const sql = `UPDATE ${context.escapedTableName} SET ${sets.join(', ')} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}${useReturning ? ' RETURNING *' : ''};`;

    const result = await this.connection.execute<Record<string, unknown>>(sql, values);

    if (result.count > 0 && returning && !this.returningSupport) {
      const selectSQL = `SELECT * FROM ${context.escapedTableName} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;
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

    const context = this.getContext(modelClass);
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${this.escapeIdentifier(field.name)} = ${this.getPlaceholder(values.length + 1)}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      sets.push(`${this.escapeIdentifier(field.name)} = ${this.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, where);

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = this.shiftPlaceholders ? this.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${context.escapedTableName} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`;

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
    const context = this.getContext(modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];
    const updates: string[] = [];

    for (const field of context.simpleFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
      if (field.name !== 'id') {
        updates.push(`${this.escapeIdentifier(field.name)} = EXCLUDED.${this.escapeIdentifier(field.name)}`);
      }
    }

    for (const field of context.complexFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
      updates.push(`${this.escapeIdentifier(field.name)} = EXCLUDED.${this.escapeIdentifier(field.name)}`);
    }

    const placeholders = columns.map((_, index) => this.getPlaceholder(index + 1));
    const sql = this.getUpsertSQL(context, columns, placeholders, conflictTarget, updates);

    const result = await this.connection.execute<Record<string, unknown>>(sql, values);
    if (result.records.length > 0) {
      return this.loadSingle(modelClass, result.records[0]);
    } else {
      return this.get(modelClass, rawItem.id as string);
    }
  }

  // Crud Support
  async get<T extends ModelType>(modelClass: Class<T>, id: string): Promise<T> {
    const context = this.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, castTo({ id }));
    const sql = `SELECT * FROM ${context.escapedTableName} WHERE ${whereSQL};`;

    const result = await this.connection.execute<Record<string, unknown>>(sql, parameters);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }

    return this.loadSingle(modelClass, result.records[0]);
  }

  async create<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>, modelSource?: ModelCrudProvider): Promise<T> {
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: this.idSource });
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const context = this.getContext(modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const placeholders = columns.map((_, index) => this.getPlaceholder(index + 1));
    const sql = `INSERT INTO ${context.escapedTableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`;

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
    return this.executeUpsert(modelClass, item, [this.escapeIdentifier('id')], modelSource);
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
    const context = this.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, castTo({ id }), false);
    const sql = `DELETE FROM ${context.escapedTableName} WHERE ${whereSQL};`;

    const result = await this.connection.execute(sql, parameters);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }
  }

  async *list<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    yield* this.listWithOffset(modelClass, options);
  }

  async *listWithOffset<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions & { offset?: number }): AsyncIterable<T[]> {
    const context = this.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, undefined);

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${context.escapedTableName} ${whereSQL ? `WHERE ${whereSQL}` : ''} LIMIT ${batchLimit} OFFSET ${offset};`;

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

  // Storage Support
  async createStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      warnIfNonIndexedIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      const context = this.getContext(modelClass);
      await this.upsertTable(context);
    }
  }

  async deleteStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      const context = this.getContext(modelClass);
      await this.dropTable(context);
    }
  }

  async deleteModel(modelClass: Class): Promise<void> {
    const context = this.getContext(modelClass);
    await this.dropTable(context);
  }

  async upsertModel(modelClass: Class): Promise<void> {
    const context = this.getContext(modelClass);
    await this.upsertTable(context);
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
      async op => {
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

    const context = this.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, where);
    const sql = `SELECT * FROM ${context.escapedTableName} WHERE ${whereSQL};`;

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

    const context = this.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, where);
    const sql = `DELETE FROM ${context.escapedTableName} WHERE ${whereSQL};`;

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

    const context = this.getContext(modelClass);

    const sortClauses = indexConfig.sortTemplate.map(({ path, value }) => {
      const expression = this.compileIndexPath(context, path, 'orderBy');
      return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
    });
    const sortSQL = sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    const { whereSQL, parameters } = this.#whereClause(modelClass, where);

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${context.escapedTableName} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} LIMIT ${batchLimit} OFFSET ${offset};`;

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

    const context = this.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, where);

    const prefixFieldPath = indexConfig.sortTemplate[0].path;
    const { sqlPath } = SQLQueryCompiler.resolvePath(context, prefixFieldPath, 'read');

    const placeholder = this.getPlaceholder(parameters.length + 1);
    parameters.push(`${prefix}%`);

    const likeOp = this.suggestLikeOperator ?? 'LIKE';
    const conditions = [`${sqlPath} ${likeOp} ${placeholder}`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `SELECT * FROM ${context.escapedTableName} WHERE ${conditions.join(' AND ')} LIMIT ${options?.limit ?? 10};`;
    const result = await this.connection.execute(sql, parameters);

    return this.loadMany(modelClass, result.records);
  }

  // Query Support
  async query<T extends ModelType>(modelClass: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(modelClass, query);
    const context = this.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where);
    const sortSQL = SQLQueryCompiler.compileSort(context, query.sort);

    let pagination = '';
    if (query.limit !== undefined) {
      pagination += ` LIMIT ${query.limit}`;
    }
    if (query.offset !== undefined) {
      pagination += ` OFFSET ${query.offset}`;
    }

    const sql = `SELECT * FROM ${context.escapedTableName} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} ${pagination};`;
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
    const context = this.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where);
    const sql = `SELECT COUNT(*) as "total" FROM ${context.escapedTableName} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

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

    const context = this.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where);

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${this.escapeIdentifier(field.name)} = ${this.getPlaceholder(values.length + 1)}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      sets.push(`${this.escapeIdentifier(field.name)} = ${this.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const conditions = [`${this.escapeIdentifier('id')} = ${this.getPlaceholder(values.length + 1)}`];
    values.push(preppedItem.id);

    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = this.shiftPlaceholders ? this.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${context.escapedTableName} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')};`;

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
    const context = this.getContext(modelClass);
    const { whereSQL, parameters = [] } = this.#whereClause(modelClass, query.where, false);

    const sql = `DELETE FROM ${context.escapedTableName} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

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
    return ModelQuerySuggestUtil.combineSuggestResults<T, T>(modelClass, field, prefix, results, (_, val) => val, query?.limit);
  }

  // Facet Support
  async facetByQuery<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    query?: ModelQuery<T>
  ): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(modelClass, query);
    const context = this.getContext(modelClass);
    const { whereSQL, parameters } = this.#whereClause(modelClass, query?.where);
    const { sqlPath } = SQLQueryCompiler.resolvePath(context, String(field).split('.'), 'read');

    const conditions = [`${sqlPath} IS NOT NULL`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const keySql = this.castColumn?.(sqlPath, String) ?? sqlPath;
    const countSql = this.castColumn?.('COUNT(*)', Number) ?? 'COUNT(*)';

    const sql = `
      SELECT ${keySql} AS ${this.escapeIdentifier('key')}, ${countSql} AS ${this.escapeIdentifier('count')}
      FROM ${context.escapedTableName}
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${sqlPath}
      ORDER BY ${this.escapeIdentifier('count')} DESC;
    `;

    const result = await this.connection.execute<{ key: string; count: string | number }>(sql, parameters);

    return result.records.map(record => ({
      key: record.key,
      count: Number(record.count)
    }));
  }
}
