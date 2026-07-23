import { AbstractANSI99Dialect, type TableContext, type TransactionStatements } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export class SqliteDialect extends AbstractANSI99Dialect {
  returningSupport = true;
  complexColumnType = 'TEXT';

  transactionStatements: TransactionStatements = {
    ...AbstractANSI99Dialect.TRANSACTION_STATEMENTS,
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

  getTableExistsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `
SELECT name 
FROM sqlite_master 
WHERE type='table' AND name=?;`,
      parameters: [context.tableName]
    };
  }

  parseTableExistsResult(records: unknown[]): boolean {
    return records.length > 0;
  }

  getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `PRAGMA table_info('${this.escapeLiteral(context.tableName)}');`
    };
  }

  parseExistingColumns(records: unknown[]): Map<string, string> {
    return new Map(castTo<{ name: string; type: string }[]>(records).map(record => [record.name, record.type.toUpperCase()]));
  }

  getExistingIndexesQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `
SELECT name, sql 
FROM sqlite_master 
WHERE type='index' AND tbl_name=?;
`,
      parameters: [context.tableName]
    };
  }

  parseExistingIndexes(records: unknown[]): Map<string, string> {
    return new Map(
      castTo<{ name: string; sql: string }[]>(records)
        .filter(record => record.sql && !record.name.startsWith('sqlite_'))
        .map(record => [record.name, record.sql])
    );
  }

  getDropIndexSQL(context: TableContext, indexName: string): string {
    return `DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)};`;
  }

  getTruncateTableSQL(context: TableContext): string {
    return `DELETE FROM ${this.escapeIdentifier(context.tableName)};`;
  }
}
