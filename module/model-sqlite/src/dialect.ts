import { AbstractANSI99Dialect, type TableContext, type TransactionStatements } from '@travetto/model-sql';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

export class SqliteDialect extends AbstractANSI99Dialect {
  returningSupport = true;
  transactionStatements: TransactionStatements = {
    ...AbstractANSI99Dialect.TRANSACTION_STATEMENTS,
    begin: 'BEGIN IMMEDIATE;'
  };

  getComplexColumnType(field: SchemaFieldConfig): string {
    return 'TEXT';
  }

  getColumnType(fieldConfiguration: SchemaFieldConfig): string {
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

  compileArrayAll(sqlPath: string, identifier: string, value: unknown[]): { sql: string; formatted: unknown } {
    return {
      sql: `NOT EXISTS (SELECT 1 FROM json_each(${identifier}) AS req WHERE req.value NOT IN (SELECT value FROM json_each(${sqlPath})))`,
      formatted: JSONUtil.toUTF8(value)
    };
  }

  compileArrayEquals(sqlPath: string, identifier: string, values: unknown): { sql: string; formatted: unknown } {
    if (Array.isArray(values)) {
      return {
        sql: `NOT EXISTS (SELECT 1 FROM json_each(${identifier}) AS req WHERE req.value NOT IN (SELECT value FROM json_each(${sqlPath})))`,
        formatted: JSONUtil.toUTF8(values)
      };
    }
    if (typeof values === 'object' && values !== null) {
      return {
        sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) AS elem WHERE NOT EXISTS (SELECT 1 FROM json_each(${identifier}) AS req WHERE json_extract(elem.value, '$.' || req.key) IS NOT req.value))`,
        formatted: JSONUtil.toUTF8(values)
      };
    }
    return {
      sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${identifier})`,
      formatted: values
    };
  }

  compileArrayAny(sqlPath: string, identifier: string, values: unknown[]): { sql: string; formatted: unknown } {
    return {
      sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) AS elem WHERE elem.value IN (SELECT value FROM json_each(${identifier})))`,
      formatted: JSONUtil.toUTF8(values)
    };
  }

  compileArrayExists(sqlPath: string): { sql: string } {
    return { sql: `(${sqlPath} IS NOT NULL AND json_array_length(${sqlPath}) > 0)` };
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
