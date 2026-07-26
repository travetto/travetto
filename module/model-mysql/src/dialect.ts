import { AbstractANSI99Dialect, type JSONSqlPathMode, type ResolvedPathContext, type TableContext } from '@travetto/model-sql';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';
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
    return `${columnName}->>'$.${this.formatJsonPath(jsonPath)}'`;
  }

  #formatSubPath(context: ResolvedPathContext): string {
    if (!context.subPath || context.subPath.length === 0) {
      return '';
    }
    const subPathMetadata = this.getSchemaSubPathMetadata(context.arrayField?.type, context.subPath);
    return subPathMetadata.map(({ segment, isArray }) => (isArray ? `${segment}[*]` : segment)).join('.');
  }

  #getArraySqlPath(context: ResolvedPathContext): string {
    if (!context.arrayPath || context.arrayPath.length === 0 || !context.subPath || context.subPath.length === 0) {
      return context.sqlPath;
    }
    const columnName = this.escapeIdentifier(context.arrayPath[0]);
    const arrayPathPart = context.arrayPath.length > 1 ? context.arrayPath.slice(1).join('.') : '';
    const formattedSubPath = this.#formatSubPath(context);
    const jsonPathExpr = arrayPathPart ? `$.${arrayPathPart}[*].${formattedSubPath}` : `$[*].${formattedSubPath}`;
    return `JSON_EXTRACT(${columnName}, '${jsonPathExpr}')`;
  }

  compileArrayAll(context: ResolvedPathContext, identifier: string, value: unknown[]): { sql: string; formatted: unknown } {
    const targetSqlPath = this.#getArraySqlPath(context);
    return { sql: `JSON_CONTAINS(${targetSqlPath}, ${identifier})`, formatted: JSONUtil.toUTF8(value) };
  }

  compileArrayEquals(context: ResolvedPathContext, identifier: string, values: unknown): { sql: string; formatted: unknown } {
    const targetSqlPath = this.#getArraySqlPath(context);
    const val = context.subPath?.length && !Array.isArray(values) ? [values] : values;
    return { sql: `JSON_CONTAINS(${targetSqlPath}, ${identifier})`, formatted: JSONUtil.toUTF8(val) };
  }

  compileArrayAny(context: ResolvedPathContext, identifier: string, values: unknown[]): { sql: string; formatted: unknown } {
    const targetSqlPath = this.#getArraySqlPath(context);
    return { sql: `JSON_OVERLAPS(${targetSqlPath}, ${identifier})`, formatted: JSONUtil.toUTF8(values) };
  }

  compileArrayExists(context: ResolvedPathContext, identifier?: string): { sql: string } {
    const targetSqlPath = this.#getArraySqlPath(context);
    return { sql: `(${targetSqlPath} IS NOT NULL AND JSON_LENGTH(${targetSqlPath}) > 0)` };
  }

  compileArrayRegex(context: ResolvedPathContext, identifier: string, value: RegExp | string): { sql: string; formatted: unknown } {
    const targetSqlPath = this.#getArraySqlPath(context);
    const regex = value instanceof RegExp ? value : new RegExp(String(value));
    const caseInsensitive = regex.flags.includes('i');
    const regexOp = this.getRegexOperator(caseInsensitive);
    const regexSource = this.formatRegex(regex.source, caseInsensitive);

    return {
      sql: `EXISTS (SELECT 1 FROM JSON_TABLE(${targetSqlPath}, '$[*]' COLUMNS (val VARCHAR(255) PATH '$')) AS jt WHERE jt.val ${regexOp} ${identifier})`,
      formatted: regexSource
    };
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
    } else if (type === String) {
      return `(CAST(${sqlPath} AS CHAR(255)) COLLATE utf8mb4_bin)`;
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
    const mysqlUpdateStatements = updates.map(statement => statement.replaceAll(/EXCLUDED\.(.*)/g, 'new_row.$1'));
    return `INSERT INTO ${this.escapeIdentifier(context.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) AS new_row ON DUPLICATE KEY UPDATE ${mysqlUpdateStatements.join(', ')};`;
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
  COLUMN_TYPE as type 
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
SELECT 
  INDEX_NAME as name,
  TABLE_NAME as tableName,
  NON_UNIQUE as nonUnique,
  GROUP_CONCAT(COALESCE(EXPRESSION, COLUMN_NAME) ORDER BY SEQ_IN_INDEX SEPARATOR ', ') as indexColumns
FROM information_schema.statistics 
WHERE 
  table_schema = ? 
  AND table_name = ? 
  AND INDEX_NAME != 'PRIMARY'
GROUP BY INDEX_NAME, TABLE_NAME, NON_UNIQUE;
`,
      parameters: [context.database, context.tableName]
    };
  }

  parseExistingIndexes(records: unknown[]): Map<string, string> {
    return new Map(
      castTo<{ name: string; tableName: string; nonUnique: number; indexColumns: string }[]>(records).map(record => {
        const isUnique = Number(record.nonUnique) === 0;
        const indexDefinition = `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(record.name)} ON ${this.escapeIdentifier(record.tableName)} (${record.indexColumns});`;
        return [record.name, indexDefinition];
      })
    );
  }

  override getDropIndexSQL(context: TableContext, indexName: string): string {
    return `DROP INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(context.tableName)};`;
  }

  override getTruncateTableSQL(context: TableContext): string {
    return `TRUNCATE TABLE ${this.escapeIdentifier(context.tableName)};`;
  }

  override getAlterColumnTypeSQL(context: TableContext, columnName: string, columnType: string, existingType: string): string | undefined {
    const normalizedExisting = existingType.replaceAll('CHARACTER VARYING', 'VARCHAR').replaceAll('INTEGER', 'INT');
    const normalizedRequested = columnType.toUpperCase().replaceAll('CHARACTER VARYING', 'VARCHAR').replaceAll('INTEGER', 'INT');

    if (!normalizedExisting.startsWith(normalizedRequested) && !normalizedRequested.startsWith(normalizedExisting)) {
      return `ALTER TABLE ${this.escapeIdentifier(context.tableName)} MODIFY COLUMN ${this.escapeIdentifier(columnName)} ${columnType};`;
    }
    return undefined;
  }
}
