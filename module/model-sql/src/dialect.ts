import { type IndexConfig, ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { isModelQueryIndex } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

import type { SQLConnection } from './connection.ts';
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

  getTableExists(context: TableContext, connection: SQLConnection): Promise<boolean>;
  getExistingColumns(context: TableContext, connection: SQLConnection): Promise<Map<string, string>>;
  getExistingIndexes(context: TableContext, connection: SQLConnection): Promise<Map<string, string>>;
  dropIndex(context: TableContext, indexName: string, connection: SQLConnection): Promise<void>;
  handleColumnTypeMismatch?(
    context: TableContext,
    columnName: string,
    columnType: string,
    existingType: string,
    connection: SQLConnection
  ): Promise<void>;
  upsertTable(context: TableContext, connection: SQLConnection): Promise<void>;
  dropTable(context: TableContext, connection: SQLConnection): Promise<void>;
  truncateTable(context: TableContext, connection: SQLConnection): Promise<void>;
}

/**
 * Abstract ANSI SQL-99 Dialect base implementation
 */
export abstract class AbstractANSI99Dialect implements SQLDialect {
  returningSupport = false;
  suggestLikeOperator = 'LIKE';
  abstract complexColumnType: string;

  transactionStatements: TransactionStatements = {
    begin: 'BEGIN;',
    beginNested: 'SAVEPOINT $1;',
    isolate: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
    rollback: 'ROLLBACK;',
    rollbackNested: 'ROLLBACK TO $1;',
    commit: 'COMMIT;',
    commitNested: 'RELEASE SAVEPOINT $1;'
  };

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

  abstract getTableExists(context: TableContext, connection: SQLConnection): Promise<boolean>;
  abstract getExistingColumns(context: TableContext, connection: SQLConnection): Promise<Map<string, string>>;
  abstract getExistingIndexes(context: TableContext, connection: SQLConnection): Promise<Map<string, string>>;
  abstract dropIndex(context: TableContext, indexName: string, connection: SQLConnection): Promise<void>;

  handleColumnTypeMismatch?(
    context: TableContext,
    columnName: string,
    columnType: string,
    existingType: string,
    connection: SQLConnection
  ): Promise<void>;

  async upsertTable(context: TableContext, connection: SQLConnection): Promise<void> {
    const tableExists = await this.getTableExists(context, connection);

    if (!tableExists) {
      const idType = this.getColumnType(castTo({ name: 'id', type: String }));
      const columnDefinitions: string[] = [`${this.escapeIdentifier('id')} ${idType} PRIMARY KEY`];

      for (const field of context.simpleFields.values()) {
        if (field.name === 'id') {
          continue;
        }
        const columnType = this.getColumnType(field);
        columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${columnType}`);
      }

      for (const field of context.complexFields.values()) {
        columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${this.complexColumnType}`);
      }

      const createTableSQL = `CREATE TABLE ${context.escapedTableName} (\n  ${columnDefinitions.join(',\n  ')}\n);`;
      await connection.execute(createTableSQL);

      const indexes = ModelRegistryIndex.getIndices(context.cls) || [];
      for (const index of indexes) {
        const createIndexSQL = this.getCreateIndexSQL(context, index);
        await connection.execute(createIndexSQL);
      }
    } else {
      const existingColumns = await this.getExistingColumns(context, connection);

      const requestedFieldsMap = new Map<string, string>();
      for (const field of context.simpleFields.values()) {
        requestedFieldsMap.set(field.name, this.getColumnType(field));
      }
      for (const field of context.complexFields.values()) {
        requestedFieldsMap.set(field.name, this.complexColumnType);
      }

      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = `ALTER TABLE ${context.escapedTableName} ADD COLUMN ${this.escapeIdentifier(columnName)} ${columnType};`;
          await connection.execute(addColumnSQL);
        } else if (this.handleColumnTypeMismatch) {
          const existingType = existingColumns.get(columnName)!;
          await this.handleColumnTypeMismatch(context, columnName, columnType, existingType, connection);
        }
      }

      const existingIndexes = await this.getExistingIndexes(context, connection);
      const modelIndexes = ModelRegistryIndex.getIndices(context.cls) || [];

      const definedIndexes = new Map<string, IndexConfig>();
      for (const indexConfig of modelIndexes) {
        const indexName = ['idx', context.tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');
        definedIndexes.set(indexName, indexConfig);
      }

      for (const [indexName, indexDefinition] of existingIndexes.entries()) {
        if (!definedIndexes.has(indexName)) {
          await this.dropIndex(context, indexName, connection);
        } else {
          const indexConfig = definedIndexes.get(indexName)!;
          const expectedSQL = this.getCreateIndexSQL(context, indexConfig);

          if (indexDefinition) {
            const normalizedExisting = this.normalizeIndexDefinition(indexDefinition);
            const normalizedExpected = this.normalizeIndexDefinition(expectedSQL);

            if (normalizedExisting !== normalizedExpected) {
              await this.dropIndex(context, indexName, connection);
              await connection.execute(expectedSQL);
            }
          }
        }
      }

      for (const [indexName, indexConfig] of definedIndexes.entries()) {
        if (!existingIndexes.has(indexName)) {
          const createIndexSQL = this.getCreateIndexSQL(context, indexConfig);
          await connection.execute(createIndexSQL);
        }
      }
    }
  }

  async dropTable(context: TableContext, connection: SQLConnection): Promise<void> {
    await connection.execute(`DROP TABLE IF EXISTS ${context.escapedTableName};`);
  }

  async truncateTable(context: TableContext, connection: SQLConnection): Promise<void> {
    await connection.execute(`TRUNCATE TABLE ${context.escapedTableName} CASCADE;`);
  }
}
