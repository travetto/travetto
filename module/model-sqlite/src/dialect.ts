import { AbstractANSI99Dialect, type ResolvedPathContext, type TableContext, type TransactionStatements } from '@travetto/model-sql';
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

  #getSqliteArrayContext(sqlPath: string, context?: ResolvedPathContext): { jsonArrayExpr: string; valueExpr: string } {
    if (!context?.arrayPath || context.arrayPath.length === 0) {
      return { jsonArrayExpr: sqlPath, valueExpr: 'elem.value' };
    }

    const columnName = this.escapeIdentifier(context.arrayPath[0]);
    const jsonArrayExpr =
      context.arrayPath.length > 1 ? `json_extract(${columnName}, '$.${context.arrayPath.slice(1).join('.')}')` : columnName;

    const valueExpr =
      context.subPath && context.subPath.length > 0 ? `json_extract(elem.value, '$.${context.subPath.join('.')}')` : 'elem.value';

    return { jsonArrayExpr, valueExpr };
  }

  compileArrayAll(
    sqlPath: string,
    identifier: string,
    value: unknown[],
    field?: SchemaFieldConfig,
    topLevel?: boolean,
    context?: ResolvedPathContext
  ): { sql: string; formatted: unknown } {
    const { jsonArrayExpr, valueExpr } = this.#getSqliteArrayContext(sqlPath, context);
    return {
      sql: `NOT EXISTS (SELECT 1 FROM json_each(${identifier}) AS req WHERE req.value NOT IN (SELECT ${valueExpr} FROM json_each(${jsonArrayExpr}) AS elem))`,
      formatted: JSONUtil.toUTF8(value)
    };
  }

  compileArrayEquals(
    sqlPath: string,
    identifier: string,
    values: unknown,
    field?: SchemaFieldConfig,
    topLevel?: boolean,
    context?: ResolvedPathContext
  ): { sql: string; formatted: unknown } {
    const { jsonArrayExpr, valueExpr } = this.#getSqliteArrayContext(sqlPath, context);
    if (Array.isArray(values)) {
      return {
        sql: `NOT EXISTS (SELECT 1 FROM json_each(${identifier}) AS req WHERE req.value NOT IN (SELECT ${valueExpr} FROM json_each(${jsonArrayExpr}) AS elem))`,
        formatted: JSONUtil.toUTF8(values)
      };
    }
    if (typeof values === 'object' && values !== null) {
      return {
        sql: `EXISTS (SELECT 1 FROM json_each(${jsonArrayExpr}) AS elem WHERE NOT EXISTS (SELECT 1 FROM json_each(${identifier}) AS req WHERE json_extract(elem.value, '$.' || req.key) IS NOT req.value))`,
        formatted: JSONUtil.toUTF8(values)
      };
    }
    return {
      sql: `EXISTS (SELECT 1 FROM json_each(${jsonArrayExpr}) AS elem WHERE ${valueExpr} = ${identifier})`,
      formatted: values
    };
  }

  compileArrayAny(
    sqlPath: string,
    identifier: string,
    values: unknown[],
    field?: SchemaFieldConfig,
    topLevel?: boolean,
    context?: ResolvedPathContext
  ): { sql: string; formatted: unknown } {
    const { jsonArrayExpr, valueExpr } = this.#getSqliteArrayContext(sqlPath, context);
    return {
      sql: `EXISTS (SELECT 1 FROM json_each(${jsonArrayExpr}) AS elem WHERE ${valueExpr} IN (SELECT value FROM json_each(${identifier})))`,
      formatted: JSONUtil.toUTF8(values)
    };
  }

  compileArrayExists(
    sqlPath: string,
    identifier?: string,
    field?: SchemaFieldConfig,
    topLevel?: boolean,
    context?: ResolvedPathContext
  ): { sql: string } {
    const { jsonArrayExpr } = this.#getSqliteArrayContext(sqlPath, context);
    return { sql: `(${jsonArrayExpr} IS NOT NULL AND json_array_length(${jsonArrayExpr}) > 0)` };
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
