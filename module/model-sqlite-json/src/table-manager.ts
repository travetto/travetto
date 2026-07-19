import { type IndexConfig, ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { isModelQueryIndex } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

import type { SqliteJsonConnection } from './connection.ts';
import { SqliteJsonUtil } from './util.ts';

/**
 * Table and index manager for SQLite JSON model backing
 */
export class SqliteJsonTableManager {
  connection: SqliteJsonConnection;

  constructor(connection: SqliteJsonConnection) {
    this.connection = connection;
  }

  /**
   * Compiles an index path into its SQLite SQL expression
   */
  static compileIndexPath(tableName: string, simpleFields: Map<string, SchemaFieldConfig>, path: string[]): string {
    const firstSegment = path[0];
    const escapedFirst = SqliteJsonUtil.escapeIdentifier(firstSegment);
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
      const pathString = `$.${nestedSegments.map(segment => SqliteJsonUtil.escapeLiteral(segment)).join('.')}`;
      return `(${escapedFirst} ->> '${pathString}')`;
    }
  }

  /**
   * Generates the CREATE INDEX statement for a model index in SQLite
   */
  getCreateIndexSQL(modelClass: Class, indexConfig: IndexConfig, tableName: string, simpleFields: Map<string, SchemaFieldConfig>): string {
    const indexName = ['idx', tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');

    if (isModelQueryIndex(indexConfig)) {
      const indexFields = indexConfig.fields.map(field => {
        const fieldKey = Object.keys(field)[0];
        const sortDirection = castTo<Record<string, unknown>>(field)[fieldKey];
        const isAscending = typeof sortDirection === 'number' ? sortDirection === 1 : !sortDirection;

        const path = fieldKey.split('.');
        const expression = SqliteJsonTableManager.compileIndexPath(tableName, simpleFields, path);
        return `${expression} ${isAscending ? 'ASC' : 'DESC'}`;
      });

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX ${SqliteJsonUtil.escapeIdentifier(indexName)} ON ${SqliteJsonUtil.escapeIdentifier(tableName)} (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = SqliteJsonTableManager.compileIndexPath(tableName, simpleFields, path);
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${SqliteJsonUtil.escapeIdentifier(indexName)} ON ${SqliteJsonUtil.escapeIdentifier(tableName)} (${indexFields.join(', ')});`;
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
      .replaceAll('(', '')
      .replaceAll(')', '');
  }

  /**
   * Synchronizes table structure and indexes for a model class with the database
   */
  async upsertTable(modelClass: Class, namespace?: string): Promise<void> {
    const context = SqliteJsonUtil.getContext(modelClass, namespace);

    // 1. Create table if it doesn't already exist
    const columnDefinitions: string[] = [`${SqliteJsonUtil.escapeIdentifier('id')} TEXT PRIMARY KEY`];

    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      const columnType = SqliteJsonUtil.getColumnType(field);
      columnDefinitions.push(`${SqliteJsonUtil.escapeIdentifier(field.name)} ${columnType}`);
    }

    for (const field of context.complexFields.values()) {
      columnDefinitions.push(`${SqliteJsonUtil.escapeIdentifier(field.name)} TEXT`);
    }

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${SqliteJsonUtil.escapeIdentifier(context.tableName)} (\n  ${columnDefinitions.join(',\n  ')}\n);`;
    await this.connection.execute(createTableSQL);

    // 2. Sync columns — fetch current columns and add any that are missing
    const columnQuery = await this.connection.execute<{ name: string; type: string }>(
      `PRAGMA table_info(${SqliteJsonUtil.escapeIdentifier(context.tableName)});`
    );
    const existingColumns = new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));

    for (const field of context.allFields) {
      if (field.name === 'id') {
        continue;
      }
      const targetType = SqliteJsonUtil.getColumnType(field);
      if (!existingColumns.has(field.name)) {
        await this.connection.execute(
          `ALTER TABLE ${SqliteJsonUtil.escapeIdentifier(context.tableName)} ADD COLUMN ${SqliteJsonUtil.escapeIdentifier(field.name)} ${targetType};`
        );
      }
    }

    // 3. Sync indexes
    const indexQuery = await this.connection.execute<{ name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_autoindex%';`,
      [context.tableName]
    );
    const existingIndexes = new Map(indexQuery.records.map(record => [record.name, record.sql || '']));

    const registeredIndexes = ModelRegistryIndex.getIndices(modelClass) || [];
    const activeIndexNames = new Set<string>();

    for (const indexConfig of registeredIndexes) {
      const indexName = ['idx', context.tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');
      activeIndexNames.add(indexName);

      const targetSQL = this.getCreateIndexSQL(modelClass, indexConfig, context.tableName, context.simpleFields);
      const existingSQL = existingIndexes.get(indexName);

      if (!existingSQL) {
        // Use IF NOT EXISTS to tolerate concurrent suite initialisation
        await this.connection.execute(
          targetSQL.replace(/^CREATE (UNIQUE )?INDEX /, match => match.replace('INDEX ', 'INDEX IF NOT EXISTS '))
        );
      } else if (
        SqliteJsonTableManager.normalizeIndexDefinition(existingSQL) !== SqliteJsonTableManager.normalizeIndexDefinition(targetSQL)
      ) {
        await this.connection.execute(`DROP INDEX IF EXISTS ${SqliteJsonUtil.escapeIdentifier(indexName)};`);
        await this.connection.execute(
          targetSQL.replace(/^CREATE (UNIQUE )?INDEX /, match => match.replace('INDEX ', 'INDEX IF NOT EXISTS '))
        );
      }
    }

    // Drop obsolete indexes
    for (const existingIndexName of existingIndexes.keys()) {
      if (!activeIndexNames.has(existingIndexName)) {
        await this.connection.execute(`DROP INDEX IF EXISTS ${SqliteJsonUtil.escapeIdentifier(existingIndexName)};`);
      }
    }
  }

  /**
   * Drops the database table for a model class
   */
  async dropTable(modelClass: Class, namespace?: string): Promise<void> {
    const { tableName } = SqliteJsonUtil.getContext(modelClass, namespace);
    await this.connection.execute(`DROP TABLE IF EXISTS ${SqliteJsonUtil.escapeIdentifier(tableName)};`);
  }

  /**
   * Truncates/clears all records from a model class table
   */
  async truncateTable(modelClass: Class, namespace?: string): Promise<void> {
    const { tableName } = SqliteJsonUtil.getContext(modelClass, namespace);
    await this.connection.execute(`DELETE FROM ${SqliteJsonUtil.escapeIdentifier(tableName)};`);
  }
}
