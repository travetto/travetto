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

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX ${PostgresJsonUtil.escapeIdentifier(indexName)} ON ${PostgresJsonUtil.escapeIdentifier(tableName)} (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = PostgresJsonTableManager.compileIndexPath(tableName, simpleFieldsSet, path);
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${PostgresJsonUtil.escapeIdentifier(indexName)} ON ${PostgresJsonUtil.escapeIdentifier(tableName)} (${indexFields.join(', ')});`;
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
    const context = PostgresJsonUtil.getContext(modelClass, namespace);

    // Check if table exists
    const tableCheck = await this.connection.execute<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND c.relkind = 'r'
      );`,
      [context.tableName]
    );

    const tableExists = tableCheck.records[0]?.exists ?? false;

    if (!tableExists) {
      // 1. Create table
      const columnDefinitions: string[] = [`${PostgresJsonUtil.escapeIdentifier('id')} VARCHAR(256) PRIMARY KEY`];

      for (const field of context.simpleFields) {
        if (field.name === 'id') {
          continue;
        }
        const columnType = PostgresJsonUtil.getColumnType(field);
        columnDefinitions.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} ${columnType}`);
      }

      for (const field of context.complexFields) {
        columnDefinitions.push(`${PostgresJsonUtil.escapeIdentifier(field.name)} JSONB`);
      }

      const createTableSQL = `CREATE TABLE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} (\n  ${columnDefinitions.join(',\n  ')}\n);`;
      await this.connection.execute(createTableSQL);

      // 2. Create indexes
      const indexes = ModelRegistryIndex.getIndices(modelClass) || [];
      for (const index of indexes) {
        const createIndexSQL = this.getCreateIndexSQL(modelClass, index, context.tableName, context.simpleFieldNameSet);
        await this.connection.execute(createIndexSQL);
      }
    } else {
      // 1. Fetch existing columns
      const columnQuery = await this.connection.execute<{ name: string; type: string }>(
        `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
         FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped;`,
        [context.tableName]
      );
      const existingColumns = new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));

      // 2. Sync columns
      const requestedFieldsMap = new Map<string, string>();
      for (const field of context.simpleFields) {
        requestedFieldsMap.set(field.name, PostgresJsonUtil.getColumnType(field));
      }
      for (const field of context.complexFields) {
        requestedFieldsMap.set(field.name, 'JSONB');
      }

      // Add missing columns or alter modified columns
      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = `ALTER TABLE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ADD COLUMN ${PostgresJsonUtil.escapeIdentifier(columnName)} ${columnType};`;
          await this.connection.execute(addColumnSQL);
        } else {
          const existingType = existingColumns.get(columnName)!;
          // Coarse type equivalence check
          const normalizedExisting = existingType.replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');
          const normalizedRequested = columnType.toUpperCase().replace('CHARACTER VARYING', 'VARCHAR').replace('INTEGER', 'INT');

          if (!normalizedExisting.startsWith(normalizedRequested) && !normalizedRequested.startsWith(normalizedExisting)) {
            const alterColumnSQL = `ALTER TABLE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} ALTER COLUMN ${PostgresJsonUtil.escapeIdentifier(columnName)} TYPE ${columnType} USING (${PostgresJsonUtil.escapeIdentifier(columnName)}::${columnType});`;
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
          const dropColumnSQL = `ALTER TABLE ${PostgresJsonUtil.escapeIdentifier(context.tableName)} DROP COLUMN ${PostgresJsonUtil.escapeIdentifier(columnName)};`;
          await this.connection.execute(dropColumnSQL);
        }
      }

      // 3. Sync indexes
      const indexQuery = await this.connection.execute<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1;`,
        [context.tableName]
      );
      const existingIndexes = new Map(
        indexQuery.records.filter(record => !record.indexname.endsWith('_pkey')).map(record => [record.indexname, record.indexdef])
      );

      const requestedIndexes = ModelRegistryIndex.getIndices(modelClass) || [];
      const requestedIndexesMap = new Map<string, IndexConfig>();

      for (const index of requestedIndexes) {
        const indexName = ['idx', context.tableName, index.name.toLowerCase().replaceAll('-', '_')].join('_');
        requestedIndexesMap.set(indexName, index);

        const newIndexSQL = this.getCreateIndexSQL(modelClass, index, context.tableName, context.simpleFieldNameSet);
        if (!existingIndexes.has(indexName)) {
          await this.connection.execute(newIndexSQL);
        } else {
          // Compare normalized definitions
          const normalizedExisting = PostgresJsonTableManager.normalizeIndexDefinition(existingIndexes.get(indexName)!);
          const normalizedRequested = PostgresJsonTableManager.normalizeIndexDefinition(newIndexSQL);

          if (normalizedExisting !== normalizedRequested) {
            await this.connection.execute(`DROP INDEX IF EXISTS ${PostgresJsonUtil.escapeIdentifier(indexName)};`);
            await this.connection.execute(newIndexSQL);
          }
        }
      }

      // Drop obsolete indexes
      for (const indexName of existingIndexes.keys()) {
        if (!requestedIndexesMap.has(indexName)) {
          await this.connection.execute(`DROP INDEX IF EXISTS ${PostgresJsonUtil.escapeIdentifier(indexName)};`);
        }
      }
    }
  }

  /**
   * Drops the database table for a model class
   */
  async dropTable(modelClass: Class, namespace?: string): Promise<void> {
    const { tableName } = PostgresJsonUtil.getContext(modelClass, namespace);
    await this.connection.execute(`DROP TABLE IF EXISTS ${PostgresJsonUtil.escapeIdentifier(tableName)} CASCADE;`);
  }

  /**
   * Truncates/clears all records from a model class table
   */
  async truncateTable(modelClass: Class, namespace?: string): Promise<void> {
    const { tableName } = PostgresJsonUtil.getContext(modelClass, namespace);
    await this.connection.execute(`TRUNCATE TABLE ${PostgresJsonUtil.escapeIdentifier(tableName)} CASCADE;`);
  }
}
