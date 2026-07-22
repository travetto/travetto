import type { PoolConnection } from 'mysql2/promise';

import { Injectable, PostConstruct } from '@travetto/di';
import { BaseSQLModelService, type JSONSqlPathMode, type TableContext } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { MysqlConnection } from './connection.ts';

/**
 * A MySQL JSON-based document store model service
 */
@Injectable()
export class MysqlModelService extends BaseSQLModelService {
  connection: MysqlConnection;
  returningSupport = false;
  complexColumnType = 'JSON';

  constructor(connection: MysqlConnection) {
    super();
    this.connection = connection;
  }

  get client(): PoolConnection {
    return this.connection.active!;
  }

  // Dialect hooks
  override escapeIdentifier(name: string): string {
    return `\`${name.replaceAll('`', '``')}\``;
  }

  getColumnType(fieldConfiguration: SchemaFieldConfig): string {
    if (SchemaRegistryIndex.has(fieldConfiguration.type) || fieldConfiguration.array) {
      return 'JSON';
    }

    if (fieldConfiguration.type === castTo(BigInt)) {
      return 'BIGINT';
    }

    if (fieldConfiguration.type === Number) {
      if (fieldConfiguration.precision) {
        const [digits, decimals] = fieldConfiguration.precision;
        if (decimals) {
          return `DECIMAL(${digits},${decimals})`;
        }
        if (digits < 5) {
          return 'SMALLINT';
        }
        if (digits < 10) {
          return 'INT';
        }
        return 'BIGINT';
      }
      return 'INT';
    }

    if (fieldConfiguration.type === Date) {
      return 'DATETIME(6)';
    }

    if (fieldConfiguration.type === Boolean) {
      return 'TINYINT(1)';
    }

    if (fieldConfiguration.type === String) {
      if (fieldConfiguration.specifiers?.includes('text')) {
        return 'TEXT';
      }
      return `VARCHAR(${fieldConfiguration.maxlength?.limit ?? 767})`;
    }

    return 'JSON';
  }

  compileJsonIndexPath(columnName: string, jsonPath: string[], mode: JSONSqlPathMode): string {
    const result = `${columnName}->>'$.${jsonPath.join('.')}'`;
    switch (mode) {
      case 'createIndex':
        return `(CAST(${result} as CHAR(255)) COLLATE utf8mb4_bin)`;
      case 'orderBy':
      case 'read':
        return result;
    }
  }

  compileArrayContains(sqlPath: string, ident: string, isObject: boolean, type?: Class): string {
    return isObject ? `JSON_CONTAINS(${sqlPath}, ${ident})` : `JSON_CONTAINS(${sqlPath}, JSON_ARRAY(${ident}))`;
  }

  compileJsonEquality(sqlPath: string, ident: string): string {
    return `CAST(${sqlPath} AS JSON) = CAST(${ident} AS JSON)`;
  }

  getRegexOperator(caseInsensitive: boolean): string {
    return caseInsensitive ? 'REGEXP' : 'COLLATE utf8mb4_bin REGEXP';
  }

  formatRegex(source: string, caseInsensitive: boolean): string {
    return source;
  }

  castColumn(sqlPath: string, type: Class): string {
    if (type === Number) {
      return `CAST(${sqlPath} AS DECIMAL)`;
    } else if (type === Boolean) {
      return `CAST(${sqlPath} AS SIGNED)`;
    } else if (type === Date) {
      return `CAST(${sqlPath} AS DATETIME(6))`;
    }
    return sqlPath;
  }

  getUpsertSQL(context: TableContext, columns: string[], placeholders: string[], conflictTarget: string[], updates: string[]): string {
    const mysqlUpdates = updates.map(val => val.replace(/EXCLUDED\.(.*)/g, 'VALUES($1)'));
    return `INSERT INTO ${context.escapedTableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON DUPLICATE KEY UPDATE ${mysqlUpdates.join(', ')};`;
  }

  async getTableExists(context: TableContext): Promise<boolean> {
    const tableCheck = await this.connection.execute<{ total: number }>(
      `SELECT COUNT(*) as total FROM information_schema.tables WHERE table_schema = ? AND table_name = ?;`,
      [context.database, context.tableName]
    );
    return Number(tableCheck.records[0]?.total ?? 0) > 0;
  }

  async getExistingColumns(context: TableContext): Promise<Map<string, string>> {
    const columnQuery = await this.connection.execute<{ name: string; type: string }>(
      `SELECT COLUMN_NAME as name, DATA_TYPE as type FROM information_schema.columns WHERE table_schema = ? AND table_name = ?;`,
      [context.database, context.tableName]
    );
    return new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));
  }

  async getExistingIndexes(context: TableContext): Promise<Map<string, string>> {
    const indexQuery = await this.connection.execute<{ name: string }>(
      `SELECT DISTINCT INDEX_NAME as name FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND INDEX_NAME != 'PRIMARY';`,
      [context.database, context.tableName]
    );
    return new Map(indexQuery.records.map(record => [record.name, '']));
  }

  async dropIndex(context: TableContext, indexName: string): Promise<void> {
    await this.connection.execute(`DROP INDEX ${this.escapeIdentifier(indexName)} ON ${context.escapedTableName};`);
  }

  @PostConstruct()
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
