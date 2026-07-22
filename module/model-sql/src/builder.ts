import type { ModelType } from '@travetto/model';
import { JSONUtil } from '@travetto/runtime';

import type { SQLDialect } from './dialect.ts';
import type { TableContext } from './types.ts';

/**
 * Statement builder for assembling parameterized SQL queries for model storage operations.
 */
export class SQLStatementBuilder {
  /**
   * Builds an INSERT SQL statement and values array for a given record.
   */
  static buildInsert<T extends ModelType>(
    dialect: SQLDialect,
    tableContext: TableContext<T>,
    rawItem: Record<string, unknown>
  ): { sql: string; values: unknown[] } {
    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of tableContext.simpleFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value === undefined || value === null ? null : value);
    }

    for (const field of tableContext.complexFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const placeholders = columns.map((_, index) => dialect.getPlaceholder(index + 1));
    const sql = `INSERT INTO ${tableContext.escapedTableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`;

    return { sql, values };
  }

  /**
   * Builds an UPDATE SQL statement for a full item update.
   */
  static buildUpdate<T extends ModelType>(
    dialect: SQLDialect,
    tableContext: TableContext<T>,
    rawItem: Record<string, unknown>,
    whereSQL?: string,
    whereParameters: unknown[] = []
  ): { sql: string; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of tableContext.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${dialect.escapeIdentifier(field.name)} = ${dialect.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(value === undefined || value === null ? null : value);
    }

    for (const field of tableContext.complexFields.values()) {
      sets.push(`${dialect.escapeIdentifier(field.name)} = ${dialect.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = dialect.shiftPlaceholders ? dialect.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...whereParameters);
    }

    const sql = `UPDATE ${tableContext.escapedTableName} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`;
    return { sql, values };
  }

  /**
   * Builds a partial UPDATE SQL statement.
   */
  static buildPartialUpdate<T extends ModelType>(
    dialect: SQLDialect,
    tableContext: TableContext<T>,
    preparedData: Partial<T>,
    whereSQL?: string,
    whereParameters: unknown[] = [],
    returning = false
  ): { sql: string; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [fieldName, val] of Object.entries(preparedData)) {
      const simpleField = tableContext.simpleFields.get(fieldName);
      if (simpleField) {
        sets.push(`${dialect.escapeIdentifier(fieldName)} = ${dialect.getPlaceholder(values.length + 1)}`);
        values.push(val === undefined || val === null ? null : val);
        continue;
      }

      const complexField = tableContext.complexFields.get(fieldName);
      if (complexField) {
        sets.push(`${dialect.escapeIdentifier(fieldName)} = ${dialect.getPlaceholder(values.length + 1)}`);
        values.push(val !== undefined && val !== null ? JSONUtil.toUTF8(val) : null);
      }
    }

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = dialect.shiftPlaceholders ? dialect.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...whereParameters);
    }

    const useReturning = returning && dialect.returningSupport;
    const sql = `UPDATE ${tableContext.escapedTableName} SET ${sets.join(', ')} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}${useReturning ? ' RETURNING *' : ''};`;

    return { sql, values };
  }

  /**
   * Builds an UPSERT SQL statement.
   */
  static buildUpsert<T extends ModelType>(
    dialect: SQLDialect,
    tableContext: TableContext<T>,
    rawItem: Record<string, unknown>,
    conflictTarget: string[]
  ): { sql: string; values: unknown[] } {
    const columns: string[] = [];
    const values: unknown[] = [];
    const updates: string[] = [];

    for (const field of tableContext.simpleFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value === undefined || value === null ? null : value);
      if (field.name !== 'id') {
        updates.push(`${dialect.escapeIdentifier(field.name)} = EXCLUDED.${dialect.escapeIdentifier(field.name)}`);
      }
    }

    for (const field of tableContext.complexFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
      updates.push(`${dialect.escapeIdentifier(field.name)} = EXCLUDED.${dialect.escapeIdentifier(field.name)}`);
    }

    const placeholders = columns.map((_, index) => dialect.getPlaceholder(index + 1));
    const sql = dialect.getUpsertSQL(tableContext, columns, placeholders, conflictTarget, updates);

    return { sql, values };
  }

  /**
   * Builds a SELECT SQL query string.
   */
  static buildSelect<T extends ModelType>(
    tableContext: TableContext<T>,
    options?: {
      whereSQL?: string;
      sortSQL?: string;
      limit?: number;
      offset?: number | string;
      columns?: string[];
    }
  ): string {
    const selectedColumns = options?.columns && options.columns.length > 0 ? options.columns.join(', ') : '*';
    let sql = `SELECT ${selectedColumns} FROM ${tableContext.escapedTableName}`;

    if (options?.whereSQL) {
      sql += ` WHERE ${options.whereSQL}`;
    }

    if (options?.sortSQL) {
      sql += ` ${options.sortSQL}`;
    }

    if (options?.limit !== undefined) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset !== undefined) {
      sql += ` OFFSET ${options.offset}`;
    }

    return `${sql};`;
  }

  /**
   * Builds a DELETE SQL query string.
   */
  static buildDelete<T extends ModelType>(tableContext: TableContext<T>, whereSQL?: string): string {
    if (whereSQL) {
      return `DELETE FROM ${tableContext.escapedTableName} WHERE ${whereSQL};`;
    }
    return `DELETE FROM ${tableContext.escapedTableName};`;
  }

  /**
   * Builds a COUNT SQL query string.
   */
  static buildCount<T extends ModelType>(dialect: SQLDialect, tableContext: TableContext<T>, whereSQL?: string): string {
    if (whereSQL) {
      return `SELECT COUNT(*) as ${dialect.escapeIdentifier('total')} FROM ${tableContext.escapedTableName} WHERE ${whereSQL};`;
    }
    return `SELECT COUNT(*) as ${dialect.escapeIdentifier('total')} FROM ${tableContext.escapedTableName};`;
  }

  /**
   * Builds an ORDER BY SQL clause for a sorted index configuration.
   */
  static buildIndexSort<T extends ModelType>(
    dialect: SQLDialect,
    tableContext: TableContext<T>,
    indexConfig: { sortTemplate: { path: string[]; value: number }[] }
  ): string {
    const sortClauses = indexConfig.sortTemplate.map(({ path, value }) => {
      const expression = dialect.compileIndexPath(tableContext, path, 'orderBy');
      return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }

  /**
   * Builds a faceted aggregate query string.
   */
  static buildFacet<T extends ModelType>(dialect: SQLDialect, tableContext: TableContext<T>, sqlPath: string, whereSQL?: string): string {
    const conditions = [`${sqlPath} IS NOT NULL`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const keySql = dialect.castColumn?.(sqlPath, String) ?? sqlPath;
    const countSql = dialect.castColumn?.('COUNT(*)', Number) ?? 'COUNT(*)';

    return `SELECT ${keySql} AS ${dialect.escapeIdentifier('key')}, ${countSql} AS ${dialect.escapeIdentifier('count')} FROM ${tableContext.escapedTableName} WHERE ${conditions.join(' AND ')} GROUP BY ${sqlPath} ORDER BY ${dialect.escapeIdentifier('count')} DESC;`;
  }
}
