import { AbstractANSI99Dialect, type ResolvedPathContext, type TableContext, type TransactionStatements } from '@travetto/model-sql';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

export class SqliteDialect extends AbstractANSI99Dialect {
  returningSupport = true;
  transactionStatements: TransactionStatements = {
    ...AbstractANSI99Dialect.TRANSACTION_STATEMENTS,
    begin: 'BEGIN IMMEDIATE;'
  };

  override getUpsertSQL(
    context: TableContext,
    columns: string[],
    placeholders: string[],
    conflictTarget: string[],
    updates: string[]
  ): string {
    return `INSERT INTO ${this.escapeIdentifier(context.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *;`;
  }

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
    return `json_extract(${columnName}, '$.${this.formatJsonPath(jsonPath)}')`;
  }

  #getSqliteArrayExpression(context: ResolvedPathContext): string {
    if (!context.arrayPath || context.arrayPath.length === 0) {
      return context.sqlPath;
    }

    const columnName = this.escapeIdentifier(context.arrayPath[0]);
    return context.arrayPath.length > 1 ? `json_extract(${columnName}, '$.${context.arrayPath.slice(1).join('.')}')` : columnName;
  }

  #buildSubPathCondition(context: ResolvedPathContext, parentExpression: string, onLeaf: (leafExpression: string) => string): string {
    if (!context.subPath || context.subPath.length === 0) {
      return onLeaf(parentExpression);
    }

    const subPathMetadata = this.getSchemaSubPathMetadata(context.arrayField?.type, context.subPath);
    const arraySegmentIndices = subPathMetadata
      .map((metadataItem, metadataIndex) => (metadataItem.isArray ? metadataIndex : -1))
      .filter(itemIndex => itemIndex !== -1);

    if (arraySegmentIndices.length === 0) {
      const leafExpression = `json_extract(${parentExpression}, '$.${context.subPath.join('.')}')`;
      return onLeaf(leafExpression);
    }

    const buildLevel = (levelIndex: number, currentParent: string): string => {
      const startPathIndex = levelIndex === 0 ? 0 : arraySegmentIndices[levelIndex - 1] + 1;
      const endPathIndex = arraySegmentIndices[levelIndex];
      const arrayPath = context.subPath!.slice(startPathIndex, endPathIndex + 1).join('.');
      const alias = `ing_${levelIndex}`;

      const innerCondition =
        levelIndex === arraySegmentIndices.length - 1
          ? (() => {
              const leafPath = context.subPath!.slice(endPathIndex + 1).join('.');
              const leafExpression = leafPath ? `json_extract(${alias}.value, '$.${leafPath}')` : `${alias}.value`;
              return onLeaf(leafExpression);
            })()
          : buildLevel(levelIndex + 1, `${alias}.value`);

      return `
EXISTS (
  SELECT 1 
  FROM json_each(${currentParent}, '$.${arrayPath}') AS ${alias} 
  WHERE ${innerCondition}
)`;
    };

    return buildLevel(0, parentExpression);
  }

  #buildArrayElementExists(context: ResolvedPathContext, onLeaf: (leafExpression: string) => string): string {
    const jsonArrayExpression = this.#getSqliteArrayExpression(context);
    const subPathCondition = this.#buildSubPathCondition(context, 'elem.value', onLeaf);
    return `EXISTS (
  SELECT 1 
  FROM json_each(${jsonArrayExpression}) AS elem 
  WHERE ${subPathCondition}
)`;
  }

  compileArrayAll(context: ResolvedPathContext, identifier: string, value: unknown[]): { sql: string; formatted: unknown } {
    const elementExists = this.#buildArrayElementExists(context, leafExpression => `${leafExpression} = req.value`);
    return {
      sql: `NOT EXISTS (
  SELECT 1 
  FROM json_each(${identifier}) AS req 
  WHERE NOT ${elementExists}
)`,
      formatted: JSONUtil.toUTF8(value)
    };
  }

  compileArrayEquals(context: ResolvedPathContext, identifier: string, values: unknown): { sql: string; formatted: unknown } {
    if (Array.isArray(values)) {
      return {
        sql: this.#buildArrayElementExists(context, leafExpression => `${leafExpression} IN (SELECT value FROM json_each(${identifier}))`),
        formatted: JSONUtil.toUTF8(values)
      };
    }

    if (typeof values === 'object' && values !== null) {
      return {
        sql: this.#buildArrayElementExists(context, leafExpression => `json_patch(${leafExpression}, ${identifier}) = ${leafExpression}`),
        formatted: JSONUtil.toUTF8(values)
      };
    }

    return {
      sql: this.#buildArrayElementExists(context, leafExpression => `${leafExpression} = ${identifier}`),
      formatted: values
    };
  }

  compileArrayAny(context: ResolvedPathContext, identifier: string, values: unknown[]): { sql: string; formatted: unknown } {
    return this.compileArrayEquals(context, identifier, values);
  }

  compileArrayExists(context: ResolvedPathContext, identifier?: string): { sql: string } {
    const jsonArrayExpression = this.#getSqliteArrayExpression(context);
    return { sql: `(${jsonArrayExpression} IS NOT NULL AND json_array_length(${jsonArrayExpression}) > 0)` };
  }

  compileArrayRegex(context: ResolvedPathContext, identifier: string, value: RegExp | string): { sql: string; formatted: unknown } {
    const regex = value instanceof RegExp ? value : new RegExp(String(value));
    const caseInsensitive = regex.flags.includes('i');
    const regexOp = this.getRegexOperator(caseInsensitive);
    const regexSource = this.formatRegex(regex.source, caseInsensitive);
    return {
      sql: this.#buildArrayElementExists(context, leafExpression => `${leafExpression} ${regexOp} ${identifier}`),
      formatted: regexSource
    };
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
