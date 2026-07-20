import type { DatabaseSync } from 'node:sqlite';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  type BulkOperation,
  type BulkResponse,
  type IndexConfig,
  type ModelBulkSupport,
  type ModelCrudSupport,
  ModelCrudUtil,
  ModelExpiryUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  type ModelType,
  type OptionalId
} from '@travetto/model';
import {
  type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody,
  isModelIndexedIndex,
  type KeyedIndexBody,
  type KeyedIndexSelection,
  type ModelIndexedSearchOptions,
  type ModelIndexedSupport,
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
  type ModelQueryFacet,
  type ModelQueryFacetSupport,
  type ModelQuerySuggestSupport,
  ModelQuerySuggestUtil,
  type ModelQuerySupport,
  ModelQueryUtil,
  type PageableModelQuery,
  QueryVerifier,
  type ValidStringFields
} from '@travetto/model-query';
import {
  type SQLDialect,
  SQLModelBulkUtil,
  SQLModelCrudUtil,
  SQLModelIndexedUtil,
  SQLModelQueryUtil,
  SQLModelStorageUtil,
  SQLModelUtil,
  SQLQueryCompiler
} from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { SqliteConnection } from './connection.ts';

/**
 * A SQLite JSON-based document store model service
 */
@Injectable()
export class SqliteModelService
  implements
    ModelCrudSupport,
    ModelStorageSupport,
    ModelBulkSupport,
    ModelIndexedSupport,
    ModelQuerySupport,
    ModelQueryCrudSupport,
    ModelQueryFacetSupport,
    ModelQuerySuggestSupport,
    SQLDialect
{
  idSource = ModelCrudUtil.uuidSource();
  connection: SqliteConnection;
  suggestLikeOperator = 'LIKE';

  constructor(connection: SqliteConnection) {
    this.connection = connection;
  }

  get client(): DatabaseSync {
    return this.connection.active!;
  }

  get config() {
    return this.connection.config;
  }

  // Dialect hooks
  escapeIdentifier(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
  }

  escapeLiteral(value: string): string {
    return value.replaceAll("'", "''");
  }

  getColumnType(fieldConfiguration: SchemaFieldConfig): string {
    if (SchemaRegistryIndex.has(fieldConfiguration.type) || fieldConfiguration.array) {
      return 'TEXT';
    }

    if (fieldConfiguration.type === castTo(BigInt)) {
      return 'INTEGER';
    }

    if (fieldConfiguration.type === Number) {
      return 'NUMERIC';
    }

    if (fieldConfiguration.type === Date) {
      return 'TEXT';
    }

    if (fieldConfiguration.type === Boolean) {
      return 'INTEGER';
    }

    if (fieldConfiguration.type === String) {
      return 'TEXT';
    }

    return 'TEXT';
  }

  compileIndexPath(tableName: string, simpleFields: Map<string, SchemaFieldConfig>, path: string[]): string {
    const firstSegment = path[0];
    const escapedFirst = this.escapeIdentifier(firstSegment);
    if (simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new Error(`Cannot create nested index under simple column "${firstSegment}" in table "${tableName}"`);
      }
      return escapedFirst;
    } else {
      const nestedSegments = path.slice(1);
      if (nestedSegments.length === 0) {
        return escapedFirst;
      }
      return `json_extract(${escapedFirst}, '$.${nestedSegments.join('.')}')`;
    }
  }

  getCreateIndexSQL(modelClass: Class, indexConfig: IndexConfig, tableName: string, simpleFields: Map<string, SchemaFieldConfig>): string {
    const indexName = ['idx', tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');

    if (isModelQueryIndex(indexConfig)) {
      const indexFields = indexConfig.fields.map(field => {
        const fieldKey = Object.keys(field)[0];
        const sortDirection = castTo<Record<string, unknown>>(field)[fieldKey];
        const isAscending = typeof sortDirection === 'number' ? sortDirection === 1 : !sortDirection;

        const path = fieldKey.split('.');
        const expression = this.compileIndexPath(tableName, simpleFields, path);
        return `${expression} ${isAscending ? 'ASC' : 'DESC'}`;
      });

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(tableName)} (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = this.compileIndexPath(tableName, simpleFields, path);
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(tableName)} (${indexFields.join(', ')});`;
    }

    throw new Error(`Unsupported index configuration for class ${modelClass.name}`);
  }

  getPlaceholder(index: number): string {
    return '?';
  }

  compileArrayContains(sqlPath: string, ident: string, isObject: boolean): string {
    return `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${ident})` : ident})`;
  }

  getRegexOperator(caseInsensitive: boolean): string {
    return 'REGEXP';
  }

  formatRegex(source: string, caseInsensitive: boolean): string {
    return caseInsensitive ? `(?i)${source}` : source;
  }

  castColumn(sqlPath: string, type: Class): string {
    if (type === Number) {
      return `CAST(${sqlPath} AS NUMERIC)`;
    }
    return sqlPath;
  }

  getUpsertSQL(tableName: string, columns: string[], placeholders: string[], conflictTarget: string[], updates: string[]): string {
    return `INSERT INTO ${this.escapeIdentifier(tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *;`;
  }

  static normalizeIndexDefinition(sql: string): string {
    return sql
      .toLowerCase()
      .replaceAll('"', '')
      .replaceAll("'", '')
      .replaceAll(' ', '')
      .replaceAll('asc', '')
      .replaceAll('desc', '')
      .replaceAll('(', '')
      .replaceAll(')', '');
  }

  // Schema hooks
  async upsertTable(modelClass: Class<ModelType>): Promise<void> {
    const context = SQLModelUtil.getContext(this, modelClass);

    const tableCheck = await this.connection.execute<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [
      context.tableName
    ]);

    const tableExists = tableCheck.count > 0;

    if (!tableExists) {
      const columnDefinitions: string[] = [`${this.escapeIdentifier('id')} TEXT PRIMARY KEY`];

      for (const field of context.simpleFields.values()) {
        if (field.name === 'id') {
          continue;
        }
        const columnType = this.getColumnType(field);
        columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${columnType}`);
      }

      for (const field of context.complexFields.values()) {
        columnDefinitions.push(`${this.escapeIdentifier(field.name)} TEXT`);
      }

      const createTableSQL = `CREATE TABLE ${this.escapeIdentifier(context.tableName)} (\n  ${columnDefinitions.join(',\n  ')}\n);`;
      await this.connection.execute(createTableSQL);

      const indexes = ModelRegistryIndex.getIndices(modelClass) || [];
      for (const index of indexes) {
        const createIndexSQL = this.getCreateIndexSQL(modelClass, index, context.tableName, context.simpleFields);
        await this.connection.execute(createIndexSQL);
      }
    } else {
      // PRAGMA table_info must use single quotes
      const columnQuery = await this.connection.execute<{ name: string; type: string }>(
        `PRAGMA table_info('${context.tableName.replaceAll("'", "''")}');`
      );
      const existingColumns = new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));

      const requestedFieldsMap = new Map<string, string>();
      for (const field of context.simpleFields.values()) {
        requestedFieldsMap.set(field.name, this.getColumnType(field));
      }
      for (const field of context.complexFields.values()) {
        requestedFieldsMap.set(field.name, 'TEXT');
      }

      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = `ALTER TABLE ${this.escapeIdentifier(context.tableName)} ADD COLUMN ${this.escapeIdentifier(columnName)} ${columnType};`;
          await this.connection.execute(addColumnSQL);
        }
      }

      for (const columnName of existingColumns.keys()) {
        if (columnName === 'id') {
          continue;
        }
        if (!requestedFieldsMap.has(columnName)) {
          const dropColumnSQL = `ALTER TABLE ${this.escapeIdentifier(context.tableName)} DROP COLUMN ${this.escapeIdentifier(columnName)};`;
          await this.connection.execute(dropColumnSQL);
        }
      }

      const indexQuery = await this.connection.execute<{ name: string; sql: string }>(
        `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=?;`,
        [context.tableName]
      );
      const existingIndexes = new Map(indexQuery.records.map(record => [record.name, record.sql]));

      const requestedIndexes = ModelRegistryIndex.getIndices(modelClass) || [];
      const requestedIndexesMap = new Map<string, IndexConfig>();

      for (const index of requestedIndexes) {
        const indexName = ['idx', context.tableName, index.name.toLowerCase().replaceAll('-', '_')].join('_');
        requestedIndexesMap.set(indexName, index);

        const newIndexSQL = this.getCreateIndexSQL(modelClass, index, context.tableName, context.simpleFields);
        if (!existingIndexes.has(indexName)) {
          await this.connection.execute(newIndexSQL);
        } else {
          // Compare normalized definitions
          const normalizedExisting = SqliteModelService.normalizeIndexDefinition(existingIndexes.get(indexName) ?? '');
          const normalizedRequested = SqliteModelService.normalizeIndexDefinition(newIndexSQL);

          if (normalizedExisting !== normalizedRequested) {
            await this.connection.execute(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`);
            await this.connection.execute(newIndexSQL);
          }
        }
      }

      for (const indexName of existingIndexes.keys()) {
        if (!requestedIndexesMap.has(indexName)) {
          await this.connection.execute(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`);
        }
      }
    }
  }

  async dropTable(modelClass: Class<ModelType>): Promise<void> {
    const { tableName } = SQLModelUtil.getContext(this, modelClass);
    await this.connection.execute(`DROP TABLE IF EXISTS ${this.escapeIdentifier(tableName)};`);
  }

  async truncateTable(modelClass: Class<ModelType>): Promise<void> {
    const { tableName } = SQLModelUtil.getContext(this, modelClass);
    await this.connection.execute(`DELETE FROM ${this.escapeIdentifier(tableName)};`);
  }

  @PostConstruct()
  async initialize(): Promise<void> {
    await this.connection.init();
    await this.createStorage();
    ModelExpiryUtil.registerCull(this);
  }

  // Storage Support
  async createStorage(): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      warnIfIndexedUniqueIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      warnIfNonIndexedIndex(this, modelClass, ModelRegistryIndex.getIndices(modelClass));
      await this.upsertTable(modelClass);
    }
  }

  async deleteStorage(): Promise<void> {
    return SQLModelStorageUtil.deleteStorage(this);
  }

  async deleteModel(modelClass: Class): Promise<void> {
    return SQLModelStorageUtil.deleteModel(this, modelClass);
  }

  async upsertModel(modelClass: Class): Promise<void> {
    return SQLModelStorageUtil.upsertModel(this, modelClass);
  }

  // Crud Support
  get<T extends ModelType>(modelClass: Class<T>, id: string): Promise<T> {
    return SQLModelCrudUtil.get(this.connection, this, modelClass, id);
  }

  create<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>): Promise<T> {
    return SQLModelCrudUtil.create(this.connection, this, modelClass, item, this);
  }

  update<T extends ModelType>(modelClass: Class<T>, item: T): Promise<T> {
    return SQLModelCrudUtil.update(this.connection, this, modelClass, item, this);
  }

  upsert<T extends ModelType>(modelClass: Class<T>, item: OptionalId<T>): Promise<T> {
    return SQLModelCrudUtil.upsert(this.connection, this, modelClass, item, this);
  }

  updatePartial<T extends ModelType>(modelClass: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    return SQLModelCrudUtil.updatePartial(this.connection, this, modelClass, item, view);
  }

  delete<T extends ModelType>(modelClass: Class<T>, id: string): Promise<void> {
    return SQLModelCrudUtil.delete(this.connection, this, modelClass, id);
  }

  list<T extends ModelType>(modelClass: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    return SQLModelCrudUtil.list(this.connection, this, modelClass, options);
  }

  // Bulk Support
  processBulk<T extends ModelType>(modelClass: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse> {
    return SQLModelBulkUtil.processBulk(this.connection, this, modelClass, operations, this);
  }

  // Expiry Support
  deleteExpired<T extends ModelType>(modelClass: Class<T>): Promise<number> {
    return ModelExpiryUtil.deleteExpired(this, modelClass);
  }

  // Indexed Support
  getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    return SQLModelIndexedUtil.getByIndex(this.connection, this, modelClass, index, body);
  }

  deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    return SQLModelIndexedUtil.deleteByIndex(this.connection, this, modelClass, index, body);
  }

  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    return SQLModelIndexedUtil.upsertByIndex(this, modelClass, index, body);
  }

  updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SingleItemIndex<T, K, S>,
    body: T
  ): Promise<T> {
    return SQLModelIndexedUtil.updateByIndex(this.connection, this, modelClass, index, body, this);
  }

  updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    return SQLModelIndexedUtil.updatePartialByIndex(this.connection, this, modelClass, index, body);
  }

  listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    return SQLModelIndexedUtil.listByIndex(this.connection, this, modelClass, index, body, options);
  }

  pageByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelClass: Class<T>,
    index: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions
  ): Promise<ModelPageResult<T>> {
    return SQLModelIndexedUtil.pageByIndex(this.connection, this, modelClass, index, body, options);
  }

  suggestByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
    B extends SortedIndexSelectionType<T, S> & string
  >(
    modelClass: Class<T>,
    index: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    prefix: B,
    options?: ModelIndexedSearchOptions
  ): Promise<T[]> {
    return SQLModelIndexedUtil.suggestByIndex(this.connection, this, modelClass, index, body, prefix, options);
  }

  // Query Support
  query<T extends ModelType>(modelClass: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    return SQLModelQueryUtil.query(this.connection, this, modelClass, query);
  }

  queryOne<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, failOnMany?: boolean): Promise<T> {
    return SQLModelQueryUtil.queryOne(this.connection, this, modelClass, query, failOnMany);
  }

  queryCount<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    return SQLModelQueryUtil.queryCount(this.connection, this, modelClass, query);
  }

  // Query Crud Support
  updateByQuery<T extends ModelType>(modelClass: Class<T>, item: T, query: ModelQuery<T>): Promise<T> {
    return SQLModelQueryUtil.updateByQuery(this.connection, this, modelClass, item, query, this);
  }

  updatePartialByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    return SQLModelQueryUtil.updatePartialByQuery(this.connection, this, modelClass, query, data);
  }

  deleteByQuery<T extends ModelType>(modelClass: Class<T>, query: ModelQuery<T>): Promise<number> {
    return SQLModelQueryUtil.deleteByQuery(this.connection, this, modelClass, query);
  }

  // Suggest Support
  suggest<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    prefix?: string,
    query?: PageableModelQuery<T>
  ): Promise<T[]> {
    return ModelQuerySuggestUtil.suggest(this, modelClass, field, prefix, query);
  }

  // Facet Support
  async facetByQuery<T extends ModelType>(
    modelClass: Class<T>,
    field: ValidStringFields<T>,
    query?: ModelQuery<T>
  ): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(modelClass, query);
    const context = SQLModelUtil.getContext(this, modelClass);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(this, context, ModelQueryUtil.getWhereClause(modelClass, query?.where));
    const { sqlPath } = SQLQueryCompiler.resolvePath(this, context, String(field).split('.'));

    const conditions = [`${sqlPath} IS NOT NULL`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `
      SELECT ${sqlPath} AS ${this.escapeIdentifier('key')}, COUNT(*) AS ${this.escapeIdentifier('count')}
      FROM ${this.escapeIdentifier(context.tableName)}
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${sqlPath}
      ORDER BY ${this.escapeIdentifier('count')} DESC;
    `;

    const result = await this.connection.execute<{ key: string; count: number }>(sql, parameters);

    return result.records;
  }
}
