import type { DatabaseSync } from 'node:sqlite';

import { Injectable, PostConstruct } from '@travetto/di';
import { BaseSQLModelService, type TableContext } from '@travetto/model-sql';
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
  complexColumnType = 'TEXT';

  constructor(connection: SqliteConnection) {
    super();
    this.connection = connection;
  }

  get client(): DatabaseSync {
    return this.connection.active!;
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

  compileJsonIndexPath(columnName: string, jsonPath: string[]): string {
    return `json_extract(${columnName}, '$.${jsonPath.join('.')}')`;
  }

  compileArrayContains(sqlPath: string, ident: string, isObject: boolean, type?: Class): string {
    return isObject
      ? `json_contains(${sqlPath}, ${ident})`
      : `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${ident})`;
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

  async getTableExists(context: TableContext): Promise<boolean> {
    const tableCheck = await this.connection.execute<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [
      context.tableName
    ]);
    return tableCheck.count > 0;
  }

  async getExistingColumns(context: TableContext): Promise<Map<string, string>> {
    const columnQuery = await this.connection.execute<{ name: string; type: string }>(
      `PRAGMA table_info('${context.dialect.escapeLiteral(context.tableName)}');`
    );
    return new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));
  }

  async getExistingIndexes(context: TableContext): Promise<Map<string, string>> {
    const indexQuery = await this.connection.execute<{ name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=?;`,
      [context.tableName]
    );
    return new Map(
      indexQuery.records.filter(record => record.sql && !record.name.startsWith('sqlite_')).map(record => [record.name, record.sql])
    );
  }

  async dropIndex(context: TableContext, indexName: string): Promise<void> {
    await this.connection.execute(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`);
  }

  async truncateTable(context: TableContext): Promise<void> {
    await this.connection.execute(`DELETE FROM ${context.escapedTableName};`);
  }

  @PostConstruct()
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
