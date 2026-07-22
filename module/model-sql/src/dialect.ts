import type { IndexConfig } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { isModelQueryIndex } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

import type { JSONSqlPathMode, TableContext } from './types.ts';

export interface TransactionStatements {
  begin: string;
  beginNested: string;
  isolate: string;
  rollback: string;
  rollbackNested: string;
  commit: string;
  commitNested: string;
}

/**
 * Interface representing SQL Dialect-specific generation hooks and behaviors
 */
export interface SQLDialect {
  readonly returningSupport: boolean;
  readonly complexColumnType: string;
  readonly suggestLikeOperator?: string;
  readonly transactionStatements: TransactionStatements;

  escapeIdentifier(name: string): string;
  escapeLiteral(value: string): string;
  getColumnType(fieldConfiguration: SchemaFieldConfig): string;
  compileJsonIndexPath(columnName: string, jsonPath: string[], mode: JSONSqlPathMode): string;
  compileIndexPath(context: TableContext, path: string[], mode: JSONSqlPathMode): string;
  getCreateIndexSQL(context: TableContext, indexConfig: IndexConfig): string;
  getPlaceholder(index: number): string;
  compileArrayContains(sqlPath: string, identifier: string, isObject: boolean, type?: Class): string;
  compileJsonEquality?(sqlPath: string, identifier: string): string;
  getRegexOperator(caseInsensitive: boolean): string;
  formatRegex(source: string, caseInsensitive: boolean): string;
  castColumn(sqlPath: string, type: Class): string;
  getUpsertSQL(context: TableContext, columns: string[], placeholders: string[], conflictTarget: string[], updates: string[]): string;
  shiftPlaceholders?(sql: string, offset: number): string;
  normalizeIndexDefinition(sql: string): string;

  getTableExistsQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  parseTableExistsResult(records: unknown[]): boolean;
  getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  parseExistingColumns(records: unknown[]): Map<string, string>;
  getExistingIndexesQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  parseExistingIndexes(records: unknown[]): Map<string, string>;
  getDropIndexSQL(context: TableContext, indexName: string): string;
  getDropTableSQL(context: TableContext): string;
  getTruncateTableSQL(context: TableContext): string;
  getAlterColumnTypeSQL?(context: TableContext, columnName: string, columnType: string, existingType: string): string | undefined;
}

/**
 * Abstract ANSI SQL-99 Dialect base implementation
 */
export abstract class AbstractANSI99Dialect implements SQLDialect {
  static TRANSACTION_STATEMENTS: TransactionStatements = {
    begin: 'BEGIN;',
    beginNested: 'SAVEPOINT $1;',
    isolate: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
    rollback: 'ROLLBACK;',
    rollbackNested: 'ROLLBACK TO $1;',
    commit: 'COMMIT;',
    commitNested: 'RELEASE SAVEPOINT $1;'
  };

  returningSupport = false;
  suggestLikeOperator = 'LIKE';
  abstract complexColumnType: string;

  transactionStatements: TransactionStatements = AbstractANSI99Dialect.TRANSACTION_STATEMENTS;

  escapeIdentifier(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
  }

  escapeLiteral(value: string): string {
    return value.replaceAll("'", "''");
  }

  getPlaceholder(index: number): string {
    return '?';
  }

  abstract getColumnType(fieldConfiguration: SchemaFieldConfig): string;
  abstract compileJsonIndexPath(columnName: string, jsonPath: string[], mode: JSONSqlPathMode): string;
  abstract compileArrayContains(sqlPath: string, identifier: string, isObject: boolean, type?: Class): string;
  abstract getRegexOperator(caseInsensitive: boolean): string;
  abstract formatRegex(source: string, caseInsensitive: boolean): string;
  abstract castColumn(sqlPath: string, type: Class): string;

  compileIndexPath(context: TableContext, path: string[], mode: JSONSqlPathMode): string {
    const firstSegment = path[0];
    const escapedFirst = this.escapeIdentifier(firstSegment);
    if (context.simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new Error(`Cannot create nested index under simple column "${firstSegment}" in table "${context.tableName}"`);
      }
      return escapedFirst;
    } else {
      const nestedSegments = path.slice(1);
      if (nestedSegments.length === 0) {
        return escapedFirst;
      }
      return this.compileJsonIndexPath(escapedFirst, nestedSegments, mode);
    }
  }

  getCreateIndexSQL(context: TableContext, indexConfig: IndexConfig): string {
    const { tableName, cls: modelClass } = context;
    const indexName = ['idx', tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');

    if (isModelQueryIndex(indexConfig)) {
      const indexFields = indexConfig.fields.map(field => {
        const fieldKey = Object.keys(field)[0];
        const sortDirection = castTo<Record<string, unknown>>(field)[fieldKey];
        const isAscending = typeof sortDirection === 'number' ? sortDirection === 1 : !sortDirection;

        const path = fieldKey.split('.');
        const expression = this.compileIndexPath(context, path, 'createIndex');
        return `${expression} ${isAscending ? 'ASC' : 'DESC'}`;
      });

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${context.escapedTableName} (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = this.compileIndexPath(context, path, 'createIndex');
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${context.escapedTableName} (${indexFields.join(', ')});`;
    }

    throw new Error(`Unsupported index configuration for class ${modelClass.name}`);
  }

  getUpsertSQL(context: TableContext, columns: string[], placeholders: string[], conflictTarget: string[], updates: string[]): string {
    return `INSERT INTO ${context.escapedTableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *;`;
  }

  normalizeIndexDefinition(sql: string): string {
    return sql
      .toLowerCase()
      .replaceAll('"', '')
      .replaceAll("'", '')
      .replaceAll(' ', '')
      .replaceAll('asc', '')
      .replaceAll('desc', '')
      .replaceAll('btree', '')
      .replaceAll('public.', '')
      .replaceAll('::text', '')
      .replaceAll('(', '')
      .replaceAll(')', '');
  }

  abstract getTableExistsQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  abstract parseTableExistsResult(records: unknown[]): boolean;
  abstract getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  abstract parseExistingColumns(records: unknown[]): Map<string, string>;
  abstract getExistingIndexesQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  abstract parseExistingIndexes(records: unknown[]): Map<string, string>;

  getDropIndexSQL(context: TableContext, indexName: string): string {
    return `DROP INDEX ${this.escapeIdentifier(indexName)} ON ${context.escapedTableName};`;
  }

  getDropTableSQL(context: TableContext): string {
    return `DROP TABLE IF EXISTS ${context.escapedTableName};`;
  }

  getTruncateTableSQL(context: TableContext): string {
    return `TRUNCATE TABLE ${context.escapedTableName} CASCADE;`;
  }
}
