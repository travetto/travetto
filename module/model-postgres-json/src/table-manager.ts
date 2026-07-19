import { type IndexConfig, ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { isModelQueryIndex } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';

import type { PostgresJsonConnection } from './connection.ts';
import { PostgresJsonUtil } from './util.ts';

/**
 * Table and index manager for Postgres JSON model backing
 */
export class PostgresJsonTableManager {
  connection: PostgresJsonConnection;

  constructor(connection: PostgresJsonConnection) {
    this.connection = connection;
  }

  /**
   * Resolves the Postgres table name for a model class
   */
  static getTableName(modelClass: Class, namespace?: string): string {
    let tableName = ModelRegistryIndex.getStoreName(modelClass);
    if (namespace) {
      tableName = `${namespace}_${tableName}`;
    }
    return tableName;
  }

  /**
   * Compiles an index path into its SQL expression
   */
  static compileIndexPath(tableName: string, simpleFieldsSet: Set<string>, path: string[]): string {
    const firstSegment = path[0];
    const escapedFirst = PostgresJsonUtil.escapeIdentifier(firstSegment);
    if (simpleFieldsSet.has(firstSegment)) {
      if (path.length > 1) {
        throw new Error(`Cannot create nested index under simple column "${firstSegment}" in table "${tableName}"`);
      }
      return escapedFirst;
    } else {
      // It is a complex (JSONB) column
      const nestedSegments = path.slice(1);
      if (nestedSegments.length === 0) {
        return escapedFirst;
      }
      const jsonAccessor = nestedSegments
        .slice(0, -1)
        .map(segment => `->'${PostgresJsonUtil.escapeLiteral(segment)}'`)
        .join('');
      const leafSegment = nestedSegments[nestedSegments.length - 1];
      // Surround with extra parentheses as required by Postgres for expression indexes
      return `((${escapedFirst}${jsonAccessor}->>'${PostgresJsonUtil.escapeLiteral(leafSegment)}'))`;
    }
  }

  /**
   * Generates the CREATE INDEX statement for a model index
   */
  getCreateIndexSQL(modelClass: Class, indexConfig: IndexConfig, tableName: string, simpleFieldsSet: Set<string>): string {
    const indexName = ['idx', tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');

    if (isModelQueryIndex(indexConfig)) {
      const indexFields = indexConfig.fields.map(field => {
        const fieldKey = Object.keys(field)[0];
        const sortDirection = castTo<Record<string, unknown>>(field)[fieldKey];
        const isAscending = typeof sortDirection === 'number' ? sortDirection === 1 : !sortDirection;

        const path = fieldKey.split('.');
        const expression = PostgresJsonTableManager.compileIndexPath(tableName, simpleFieldsSet, path);
        return `${expression} ${isAscending ? 'ASC' : 'DESC'}`;
      });

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX "${indexName}" ON "${tableName}" (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = PostgresJsonTableManager.compileIndexPath(tableName, simpleFieldsSet, path);
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX "${indexName}" ON "${tableName}" (${indexFields.join(', ')});`;
    }

    throw new Error(`Unsupported index configuration for class ${modelClass.name}`);
  }

  /**
   * Normalizes an index definition string for comparison
   */
  static normalizeIndexDefinition(sql: string): string {
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

  /**
   * Synchronizes table structure and indexes for a model class with the database
   */
  async upsertTable(modelClass: Class, namespace?: string): Promise<void> {
    const tableName = PostgresJsonTableManager.getTableName(modelClass, namespace);
    const classification = PostgresJsonUtil.classifyFields(modelClass);
    const simpleFieldsSet = new Set(classification.simpleFields.map(field => field.name));

    // Check if table exists
    const tableCheck = await this.connection.execute<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND c.relkind = 'r'
      );`,
      [tableName]
    );

    const tableExists = tableCheck.records[0]?.exists ?? false;

    if (!tableExists) {
      // 1. Create table
      const columnDefinitions: string[] = [`"id" VARCHAR(256) PRIMARY KEY`];

      for (const field of classification.simpleFields) {
        if (field.name === 'id') {
          continue;
        }
        const columnType = PostgresJsonUtil.getColumnType(field);
        columnDefinitions.push(`"${field.name}" ${columnType}`);
      }

      for (const field of classification.complexFields) {
        columnDefinitions.push(`"${field.name}" JSONB`);
      }

      const createTableSQL = `CREATE TABLE "${tableName}" (\n  ${columnDefinitions.join(',\n  ')}\n);`;
      await this.connection.execute(createTableSQL);

      // 2. Create indexes
      const indexes = ModelRegistryIndex.getIndices(modelClass) || [];
      for (const index of indexes) {
        const createIndexSQL = this.getCreateIndexSQL(modelClass, index, tableName, simpleFieldsSet);
        await this.connection.execute(createIndexSQL);
      }
    } else {
      // 1. Fetch existing columns
      const columnQuery = await this.connection.execute<{ name: string; type: string }>(
        `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
         FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped;`,
        [tableName]
      );
      const existingColumns = new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));

      // 2. Sync columns
      const requestedFieldsMap = new Map<string, string>();
      for (const field of classification.simpleFields) {
        requestedFieldsMap.set(field.name, PostgresJsonUtil.getColumnType(field));
      }
      for (const field of classification.complexFields) {
        requestedFieldsMap.set(field.name, 'JSONB');
      }

      // Add missing columns or alter modified columns
      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType};`;
          await this.connection.execute(addColumnSQL);
        } else {
          const existingType = existingColumns.get(columnName)!;
          // Coarse type equivalence check
          const normalizedExisting = existingType.replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');
          const normalizedRequested = columnType.toUpperCase().replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');

          if (!normalizedExisting.startsWith(normalizedRequested) && !normalizedRequested.startsWith(normalizedExisting)) {
            const alterColumnSQL = `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE ${columnType} USING ("${columnName}"::${columnType});`;
            await this.connection.execute(alterColumnSQL);
          }
        }
      }

      // Drop obsolete columns
      for (const columnName of existingColumns.keys()) {
        if (columnName === 'id') {
          continue;
        }
        if (!requestedFieldsMap.has(columnName)) {
          const dropColumnSQL = `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}";`;
          await this.connection.execute(dropColumnSQL);
        }
      }

      // 3. Sync indexes
      const indexQuery = await this.connection.execute<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1;`,
        [tableName]
      );
      const existingIndexes = new Map(
        indexQuery.records.filter(record => !record.indexname.endsWith('_pkey')).map(record => [record.indexname, record.indexdef])
      );

      const requestedIndexes = ModelRegistryIndex.getIndices(modelClass) || [];
      const requestedIndexesMap = new Map<string, IndexConfig>();

      for (const index of requestedIndexes) {
        const indexName = ['idx', tableName, index.name.toLowerCase().replaceAll('-', '_')].join('_');
        requestedIndexesMap.set(indexName, index);

        const newIndexSQL = this.getCreateIndexSQL(modelClass, index, tableName, simpleFieldsSet);
        if (!existingIndexes.has(indexName)) {
          await this.connection.execute(newIndexSQL);
        } else {
          // Compare normalized definitions
          const normalizedExisting = PostgresJsonTableManager.normalizeIndexDefinition(existingIndexes.get(indexName)!);
          const normalizedRequested = PostgresJsonTableManager.normalizeIndexDefinition(newIndexSQL);

          if (normalizedExisting !== normalizedRequested) {
            await this.connection.execute(`DROP INDEX IF EXISTS "${indexName}";`);
            await this.connection.execute(newIndexSQL);
          }
        }
      }

      // Drop obsolete indexes
      for (const indexName of existingIndexes.keys()) {
        if (!requestedIndexesMap.has(indexName)) {
          await this.connection.execute(`DROP INDEX IF EXISTS "${indexName}";`);
        }
      }
    }
  }

  /**
   * Drops the database table for a model class
   */
  async dropTable(modelClass: Class, namespace?: string): Promise<void> {
    const tableName = PostgresJsonTableManager.getTableName(modelClass, namespace);
    await this.connection.execute(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
  }

  /**
   * Truncates/clears all records from a model class table
   */
  async truncateTable(modelClass: Class, namespace?: string): Promise<void> {
    const tableName = PostgresJsonTableManager.getTableName(modelClass, namespace);
    await this.connection.execute(`TRUNCATE TABLE "${tableName}" CASCADE;`);
  }
}
