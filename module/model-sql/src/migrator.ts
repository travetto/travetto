import { type IndexConfig, ModelRegistryIndex } from '@travetto/model';
import { castTo } from '@travetto/runtime';

import type { SQLConnection } from './connection.ts';
import type { SQLDialect, TableContext } from './types.ts';

/**
 * Executes database schema storage migrations and DDL operations.
 */
export class SQLSchemaMigrator {
  /**
   * Checks if a table exists in the database.
   */
  static async getTableExists(connection: SQLConnection, dialect: SQLDialect, tableContext: TableContext): Promise<boolean> {
    const query = dialect.getTableExistsQuery(tableContext);
    const result = await connection.execute(query.sql, query.parameters);
    return dialect.parseTableExistsResult(result.records);
  }

  /**
   * Retrieves existing columns for a table from database metadata.
   */
  static async getExistingColumns(
    connection: SQLConnection,
    dialect: SQLDialect,
    tableContext: TableContext
  ): Promise<Map<string, string>> {
    const query = dialect.getExistingColumnsQuery(tableContext);
    const result = await connection.execute(query.sql, query.parameters);
    return dialect.parseExistingColumns(result.records);
  }

  /**
   * Retrieves existing indexes for a table from database metadata.
   */
  static async getExistingIndexes(
    connection: SQLConnection,
    dialect: SQLDialect,
    tableContext: TableContext
  ): Promise<Map<string, string>> {
    const query = dialect.getExistingIndexesQuery(tableContext);
    const result = await connection.execute(query.sql, query.parameters);
    return dialect.parseExistingIndexes(result.records);
  }

  /**
   * Drops a specified index from a table.
   */
  static async dropIndex(connection: SQLConnection, dialect: SQLDialect, tableContext: TableContext, indexName: string): Promise<void> {
    const sql = dialect.getDropIndexSQL(tableContext, indexName);
    await connection.execute(sql);
  }

  /**
   * Creates or updates a table schema and its indexes.
   */
  static async upsertTable(connection: SQLConnection, dialect: SQLDialect, tableContext: TableContext): Promise<void> {
    const tableExists = await this.getTableExists(connection, dialect, tableContext);

    if (!tableExists) {
      const idType = dialect.getColumnType(castTo({ name: 'id', type: String }));
      const columnDefinitions: string[] = [`${dialect.escapeIdentifier('id')} ${idType} PRIMARY KEY`];

      for (const field of tableContext.simpleFields.values()) {
        if (field.name === 'id') {
          continue;
        }
        const columnType = dialect.getColumnType(field);
        columnDefinitions.push(`${dialect.escapeIdentifier(field.name)} ${columnType}`);
      }

      for (const field of tableContext.complexFields.values()) {
        columnDefinitions.push(`${dialect.escapeIdentifier(field.name)} ${dialect.complexColumnType}`);
      }

      const createTableSQL = `CREATE TABLE ${tableContext.escapedTableName} (\n  ${columnDefinitions.join(',\n  ')}\n);`;
      await connection.execute(createTableSQL);

      const indexes = ModelRegistryIndex.getIndices(tableContext.cls) || [];
      for (const indexConfig of indexes) {
        const createIndexSQL = dialect.getCreateIndexSQL(tableContext, indexConfig);
        await connection.execute(createIndexSQL);
      }
    } else {
      const existingColumns = await this.getExistingColumns(connection, dialect, tableContext);

      const requestedFieldsMap = new Map<string, string>();
      for (const field of tableContext.simpleFields.values()) {
        requestedFieldsMap.set(field.name, dialect.getColumnType(field));
      }
      for (const field of tableContext.complexFields.values()) {
        requestedFieldsMap.set(field.name, dialect.complexColumnType);
      }

      for (const [columnName, columnType] of requestedFieldsMap.entries()) {
        if (columnName === 'id') {
          continue;
        }
        if (!existingColumns.has(columnName)) {
          const addColumnSQL = `ALTER TABLE ${tableContext.escapedTableName} ADD COLUMN ${dialect.escapeIdentifier(columnName)} ${columnType};`;
          await connection.execute(addColumnSQL);
        } else if (dialect.getAlterColumnTypeSQL) {
          const existingType = existingColumns.get(columnName)!;
          const alterColumnSQL = dialect.getAlterColumnTypeSQL(tableContext, columnName, columnType, existingType);
          if (alterColumnSQL) {
            await connection.execute(alterColumnSQL);
          }
        }
      }

      const existingIndexes = await this.getExistingIndexes(connection, dialect, tableContext);
      const modelIndexes = ModelRegistryIndex.getIndices(tableContext.cls) || [];

      const definedIndexes = new Map<string, IndexConfig>();
      for (const indexConfig of modelIndexes) {
        const indexName = ['idx', tableContext.tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');
        definedIndexes.set(indexName, indexConfig);
      }

      for (const [indexName, indexDefinition] of existingIndexes.entries()) {
        if (!definedIndexes.has(indexName)) {
          await this.dropIndex(connection, dialect, tableContext, indexName);
        } else {
          const indexConfig = definedIndexes.get(indexName)!;
          const expectedSQL = dialect.getCreateIndexSQL(tableContext, indexConfig);

          if (indexDefinition) {
            const normalizedExisting = dialect.normalizeIndexDefinition(indexDefinition);
            const normalizedExpected = dialect.normalizeIndexDefinition(expectedSQL);

            if (normalizedExisting !== normalizedExpected) {
              await this.dropIndex(connection, dialect, tableContext, indexName);
              await connection.execute(expectedSQL);
            }
          }
        }
      }

      for (const [indexName, indexConfig] of definedIndexes.entries()) {
        if (!existingIndexes.has(indexName)) {
          const createIndexSQL = dialect.getCreateIndexSQL(tableContext, indexConfig);
          await connection.execute(createIndexSQL);
        }
      }
    }
  }

  /**
   * Drops a table from the database.
   */
  static async dropTable(connection: SQLConnection, dialect: SQLDialect, tableContext: TableContext): Promise<void> {
    await connection.execute(dialect.getDropTableSQL(tableContext));
  }

  /**
   * Truncates all rows in a table.
   */
  static async truncateTable(connection: SQLConnection, dialect: SQLDialect, tableContext: TableContext): Promise<void> {
    await connection.execute(dialect.getTruncateTableSQL(tableContext));
  }
}
