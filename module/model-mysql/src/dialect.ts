import { AbstractANSI99Dialect, type JSONSqlPathMode, type TableContext } from '@travetto/model-sql';
import { type Class, castTo } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

export class MysqlDialect extends AbstractANSI99Dialect {
  override returningSupport = false;

  override escapeIdentifier(name: string): string {
    return `\`${name.replaceAll('`', '``')}\``;
  }

  getComplexColumnType(field: SchemaFieldConfig): string {
    return 'JSON';
  }

  getColumnType(fieldConfiguration: SchemaFieldConfig): string {
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

  compileArrayContains(sqlPath: string, identifier: string, isObject: boolean, field: SchemaFieldConfig): string {
    return isObject ? `JSON_CONTAINS(${sqlPath}, ${identifier})` : `JSON_CONTAINS(${sqlPath}, JSON_ARRAY(${identifier}))`;
  }

  compileJsonEquality(sqlPath: string, identifier: string): string {
    return `CAST(${sqlPath} AS JSON) = CAST(${identifier} AS JSON)`;
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

  override getUpsertSQL(
    context: TableContext,
    columns: string[],
    placeholders: string[],
    conflictTarget: string[],
    updates: string[]
  ): string {
    const mysqlUpdates = updates.map(val => val.replace(/EXCLUDED\.(.*)/g, 'VALUES($1)'));
    return `
INSERT INTO 
  ${this.escapeIdentifier(context.tableName)} (${columns.join(', ')}) 
VALUES 
  (${placeholders.join(', ')}) 
ON DUPLICATE KEY UPDATE ${mysqlUpdates.join(', ')};`;
  }

  getTableExistsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `
SELECT 
  COUNT(*) as total 
FROM information_schema.tables 
WHERE table_schema = ? AND table_name = ?;
`,
      parameters: [context.database, context.tableName]
    };
  }

  parseTableExistsResult(records: unknown[]): boolean {
    return Number(castTo<{ total: number }>(records[0])?.total ?? 0) > 0;
  }

  getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `
SELECT 
  COLUMN_NAME as name, 
  DATA_TYPE as type 
FROM information_schema.columns 
WHERE table_schema = ? AND table_name = ?;
`,
      parameters: [context.database, context.tableName]
    };
  }

  parseExistingColumns(records: unknown[]): Map<string, string> {
    return new Map(castTo<{ name: string; type: string }[]>(records).map(record => [record.name, record.type.toUpperCase()]));
  }

  getExistingIndexesQuery(context: TableContext): { sql: string; parameters?: unknown[] } {
    return {
      sql: `
SELECT DISTINCT 
  INDEX_NAME as name 
FROM information_schema.statistics 
WHERE 
  table_schema = ? 
  AND table_name = ? 
  AND INDEX_NAME != 'PRIMARY';
`,
      parameters: [context.database, context.tableName]
    };
  }

  parseExistingIndexes(records: unknown[]): Map<string, string> {
    return new Map(castTo<{ name: string }[]>(records).map(record => [record.name, '']));
  }

  override getDropIndexSQL(context: TableContext, indexName: string): string {
    return `DROP INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(context.tableName)};`;
  }
}
