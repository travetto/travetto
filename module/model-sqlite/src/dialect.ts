import { AbstractANSI99Dialect, type SQLConnection, type TableContext, type TransactionStatements } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export class SqliteDialect extends AbstractANSI99Dialect {
  override returningSupport = true;
  override complexColumnType = 'TEXT';

  override transactionStatements: TransactionStatements = {
    ...this.transactionStatements,
    begin: 'BEGIN IMMEDIATE;'
  };

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

  compileArrayContains(sqlPath: string, identifier: string, isObject: boolean, type?: Class): string {
    return isObject
      ? `json_contains(${sqlPath}, ${identifier})`
      : `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${identifier})`;
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

  async getTableExists(context: TableContext, connection: SQLConnection): Promise<boolean> {
    const tableCheck = await connection.execute<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [
      context.tableName
    ]);
    return tableCheck.count > 0;
  }

  async getExistingColumns(context: TableContext, connection: SQLConnection): Promise<Map<string, string>> {
    const columnQuery = await connection.execute<{ name: string; type: string }>(
      `PRAGMA table_info('${this.escapeLiteral(context.tableName)}');`
    );
    return new Map(columnQuery.records.map(record => [record.name, record.type.toUpperCase()]));
  }

  async getExistingIndexes(context: TableContext, connection: SQLConnection): Promise<Map<string, string>> {
    const indexQuery = await connection.execute<{ name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=?;`,
      [context.tableName]
    );
    return new Map(
      indexQuery.records.filter(record => record.sql && !record.name.startsWith('sqlite_')).map(record => [record.name, record.sql])
    );
  }

  async dropIndex(context: TableContext, indexName: string, connection: SQLConnection): Promise<void> {
    await connection.execute(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`);
  }

  override async truncateTable(context: TableContext, connection: SQLConnection): Promise<void> {
    await connection.execute(`DELETE FROM ${context.escapedTableName};`);
  }
}
