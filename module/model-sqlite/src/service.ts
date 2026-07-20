import type { DatabaseSync } from 'node:sqlite';

import { Injectable, PostConstruct } from '@travetto/di';
import type { ModelType } from '@travetto/model';
import { BaseSQLModelService, SQLModelUtil } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { SqliteConnection } from './connection.ts';

/**
 * A SQLite JSON-based document store model service
 */
@Injectable()
export class SqliteModelService extends BaseSQLModelService {
  connection: SqliteConnection;
  returningSupport = true;

  constructor(connection: SqliteConnection) {
    super();
    this.connection = connection;
  }

  get client(): DatabaseSync {
    return this.connection.active!;
  }

  get config() {
    return this.connection.config;
  }

  // Dialect hooks
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

  complexColumnType = 'TEXT';

  async getTableExists(tableName: string): Promise<boolean> {
    const tableCheck = await this.connection.execute<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [
      tableName
    ]);
    return tableCheck.count > 0;
  }

  async getExistingColumns(tableName: string): Promise<Map<string, string>> {
    const columnQuery = await this.connection.execute<{ name: string; type: string }>(
      `PRAGMA table_info('${tableName.replaceAll("'", "''")}');`
    );
    return new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));
  }

  async getExistingIndexes(tableName: string): Promise<Map<string, string>> {
    const indexQuery = await this.connection.execute<{ name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=?;`,
      [tableName]
    );
    return new Map(
      indexQuery.records.filter(record => record.sql && !record.name.startsWith('sqlite_')).map(record => [record.name, record.sql])
    );
  }

  normalizeIndexDefinition(sql: string): string {
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

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    await this.connection.execute(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`);
  }

  async truncateTable(modelClass: Class<ModelType>): Promise<void> {
    const { tableName } = SQLModelUtil.getContext(this, modelClass);
    await this.connection.execute(`DELETE FROM ${this.escapeIdentifier(tableName)};`);
  }

  @PostConstruct()
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
