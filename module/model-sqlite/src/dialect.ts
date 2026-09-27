import type { ModelType } from '@travetto/model';
import type { TextSearchClause } from '@travetto/model-query';
import {
  AbstractANSI99Dialect,
  type ResolvedPathContext,
  type TableContext,
  type TextSearchState,
  type TransactionStatements
} from '@travetto/model-sql';
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
    const regex = value instanceof RegExp ? value : new RegExp(value);
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

  buildArrayFacet<T extends ModelType>(
    tableContext: TableContext<T>,
    resolvedContext: ResolvedPathContext,
    whereSQL?: string,
    limit?: number,
    offset?: number
  ): string {
    const jsonArrayExpression = this.#getSqliteArrayExpression(resolvedContext);
    const valueExpression =
      resolvedContext.subPath && resolvedContext.subPath.length > 0
        ? `json_extract(element.value, '$.${resolvedContext.subPath.join('.')}')`
        : 'element.value';

    const countClause = this.castColumn?.('COUNT(*)', Number) ?? 'COUNT(*)';

    return `
SELECT ${valueExpression} AS ${this.escapeIdentifier('key')}, ${countClause} AS ${this.escapeIdentifier('count')}
FROM ${this.escapeIdentifier(tableContext.tableName)}, json_each(${jsonArrayExpression}) AS element
WHERE ${valueExpression} IS NOT NULL
${whereSQL ? `AND ${whereSQL}` : ''}
GROUP BY ${valueExpression}
ORDER BY ${this.escapeIdentifier('count')} DESC
${limit !== undefined ? `LIMIT ${limit}` : ''}
${offset !== undefined ? `OFFSET ${offset}` : ''};`;
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

  getDropTablesSQL(tableContexts: TableContext[]): string {
    const tableNames: string[] = [];
    for (const context of tableContexts) {
      tableNames.push(this.escapeIdentifier(context.tableName));
      const textFields = this.getTextSearchFields(context);
      if (textFields.length > 0) {
        tableNames.push(this.escapeIdentifier(`${context.tableName}_fts`));
      }
    }
    const uniqueTableNames = [...new Set(tableNames)];
    if (uniqueTableNames.length === 0) {
      return '';
    }
    const statements = uniqueTableNames.map(tableName => `DROP TABLE IF EXISTS ${tableName};`);
    return statements.length > 1 ? `-- exec\n${statements.join('\n')}` : statements[0];
  }

  getTruncateTableSQL(context: TableContext): string {
    return `DELETE FROM ${this.escapeIdentifier(context.tableName)};`;
  }

  getTruncateTableSQLs<T extends ModelType>(tableContext: TableContext<T>): string[] {
    const textFields = this.getTextSearchFields(tableContext);
    if (textFields.length === 0) {
      return super.getTruncateTableSQLs(tableContext);
    }
    const ftsTableName = `${tableContext.tableName}_fts`;
    return [
      ...super.getTruncateTableSQLs(tableContext),
      `INSERT INTO ${this.escapeIdentifier(ftsTableName)}(${this.escapeIdentifier(ftsTableName)}) VALUES ('rebuild');`
    ];
  }

  isTableNotFoundError(error: unknown): boolean {
    return error instanceof Error && /no such table/i.test(error.message);
  }

  getCreateTextSearchIndexSQLs<T extends ModelType>(tableContext: TableContext<T>): string[] {
    const textFields = this.getTextSearchFields(tableContext);
    if (textFields.length === 0) {
      return [];
    }
    const columns = textFields.map(field => this.escapeIdentifier(field.name)).join(', ');
    const ftsTableName = `${tableContext.tableName}_fts`;
    const tableName = tableContext.tableName;
    const oldColumns = textFields.map(field => `old.${this.escapeIdentifier(field.name)}`).join(', ');
    const newColumns = textFields.map(field => `new.${this.escapeIdentifier(field.name)}`).join(', ');

    return [
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${this.escapeIdentifier(ftsTableName)} USING fts5(${columns}, content=${this.escapeIdentifier(tableName)}, content_rowid=${this.escapeIdentifier('rowid')}, tokenize='porter unicode61');`,
      `CREATE TRIGGER IF NOT EXISTS ${this.escapeIdentifier(`trg_${ftsTableName}_ai`)} AFTER INSERT ON ${this.escapeIdentifier(tableName)} BEGIN INSERT INTO ${this.escapeIdentifier(ftsTableName)}(${this.escapeIdentifier('rowid')}, ${columns}) VALUES (new.${this.escapeIdentifier('rowid')}, ${newColumns}); END;`,
      `CREATE TRIGGER IF NOT EXISTS ${this.escapeIdentifier(`trg_${ftsTableName}_ad`)} AFTER DELETE ON ${this.escapeIdentifier(tableName)} BEGIN INSERT INTO ${this.escapeIdentifier(ftsTableName)}(${this.escapeIdentifier(ftsTableName)}, ${this.escapeIdentifier('rowid')}, ${columns}) VALUES ('delete', old.${this.escapeIdentifier('rowid')}, ${oldColumns}); END;`,
      `CREATE TRIGGER IF NOT EXISTS ${this.escapeIdentifier(`trg_${ftsTableName}_au`)} AFTER UPDATE ON ${this.escapeIdentifier(tableName)} BEGIN INSERT INTO ${this.escapeIdentifier(ftsTableName)}(${this.escapeIdentifier(ftsTableName)}, ${this.escapeIdentifier('rowid')}, ${columns}) VALUES ('delete', old.${this.escapeIdentifier('rowid')}, ${oldColumns}); INSERT INTO ${this.escapeIdentifier(ftsTableName)}(${this.escapeIdentifier('rowid')}, ${columns}) VALUES (new.${this.escapeIdentifier('rowid')}, ${newColumns}); END;`,
      `INSERT INTO ${this.escapeIdentifier(ftsTableName)}(${this.escapeIdentifier(ftsTableName)}) VALUES ('rebuild');`
    ];
  }

  getDropTableSQLs<T extends ModelType>(tableContext: TableContext<T>): string[] {
    const textFields = this.getTextSearchFields(tableContext);
    if (textFields.length === 0) {
      return super.getDropTableSQLs(tableContext);
    }
    const ftsTableName = `${tableContext.tableName}_fts`;
    return [
      `DROP TRIGGER IF EXISTS ${this.escapeIdentifier(`trg_${ftsTableName}_ai`)};`,
      `DROP TRIGGER IF EXISTS ${this.escapeIdentifier(`trg_${ftsTableName}_ad`)};`,
      `DROP TRIGGER IF EXISTS ${this.escapeIdentifier(`trg_${ftsTableName}_au`)};`,
      `DROP TABLE IF EXISTS ${this.escapeIdentifier(ftsTableName)};`,
      ...super.getDropTableSQLs(tableContext)
    ];
  }

  compileTextWhereClause<T extends ModelType>(
    tableContext: TableContext<T>,
    clause: TextSearchClause,
    identificationPath: string,
    fieldPath?: string[]
  ): { sql: string; parameters: Record<string, unknown> } {
    const rawQuery = typeof clause === 'string' ? clause : clause.query;
    const identifier = `%%${identificationPath}%%`;

    // SQLite FTS5 uses 'NOT' instead of '-' for term and phrase exclusion
    let textQuery = rawQuery
      .replaceAll(/(?:^|\s)-(?:"([^"]+)"|(\w+))/g, (match, phrase, word) => (phrase ? ` NOT "${phrase}"` : ` NOT ${word}`))
      .trim();
    if (fieldPath && fieldPath.length > 0) {
      const fieldName = fieldPath.at(-1)!;
      textQuery = `${this.escapeIdentifier(fieldName)}: (${textQuery})`;
    }

    const ftsTableName = `${tableContext.tableName}_fts`;

    return {
      sql: `${this.escapeIdentifier(tableContext.tableName)}."rowid" IN (SELECT "rowid" FROM ${this.escapeIdentifier(ftsTableName)} WHERE ${this.escapeIdentifier(ftsTableName)} MATCH ${identifier})`,
      parameters: { [identifier]: textQuery }
    };
  }

  compileTextScoreSort<T extends ModelType>(tableContext: TableContext<T>, direction: 1 | -1, textSearches?: TextSearchState[]): string {
    const textFields = this.getTextSearchFields(tableContext);
    if (textFields.length === 0 || !textSearches || textSearches.length === 0) {
      return '';
    }
    const ftsTableName = `${tableContext.tableName}_fts`;
    const queries = textSearches.map(entry => {
      let textQuery = entry.query
        .replaceAll(/(?:^|\s)-(?:"([^"]+)"|(\w+))/g, (match, phrase, word) => (phrase ? ` NOT "${phrase}"` : ` NOT ${word}`))
        .trim();
      if (entry.fieldPath && entry.fieldPath.length > 0) {
        const fieldName = entry.fieldPath.at(-1)!;
        textQuery = `${this.escapeIdentifier(fieldName)}: (${textQuery})`;
      }
      return textQuery;
    });
    const matchClause =
      queries.length > 0 ? ` AND ${this.escapeIdentifier(ftsTableName)} MATCH '${this.escapeLiteral(queries.join(' OR '))}'` : '';
    return `(SELECT bm25(${this.escapeIdentifier(ftsTableName)}) FROM ${this.escapeIdentifier(ftsTableName)} WHERE ${this.escapeIdentifier(ftsTableName)}."rowid" = ${this.escapeIdentifier(tableContext.tableName)}."rowid"${matchClause}) ${direction === -1 ? 'ASC' : 'DESC'}`;
  }
}
