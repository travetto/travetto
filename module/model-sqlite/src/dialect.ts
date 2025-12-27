import { SchemaFieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WhereClause } from '@travetto/model-query';
import { castTo } from '@travetto/runtime';

import { SQLModelConfig, SQLDialect, VisitStack, type SQLTableDescription } from '@travetto/model-sql';

import { SqliteConnection } from './connection.ts';

/**
 * Sqlite Dialect for the SQL Model Source
 */
@Injectable()
export class SqliteDialect extends SQLDialect {

  connection: SqliteConnection;
  config: SQLModelConfig;

  constructor(context: AsyncContext, config: SQLModelConfig) {
    super(config.namespace);
    this.connection = new SqliteConnection(context, config);
    this.config = config;

    // Special operators
    Object.assign(this.SQL_OPS, {
      $regex: 'REGEXP',
      $ilike: undefined
    });

    // Special types
    Object.assign(this.COLUMN_TYPES, {
      JSON: 'TEXT',
      TIMESTAMP: 'INTEGER'
    });
  }

  override resolveDateValue(value: Date): string {
    return `${value.getTime()}`;
  }

  /**
   * How to hash
   */
  hash(value: string): string {
    return `hex('${value}')`;
  }

  async listAllTables(): Promise<string[]> {
    const results = await this.executeSQL<{ name: string }>(`
      SELECT name 
      FROM sqlite_master 
      WHERE 
        type='table' 
        AND name NOT LIKE 'sqlite_%';
    `);
    return results.records.map(result => result.name);
  }

  async describeTable(table: string): Promise<SQLTableDescription> {
    const [columns, foreignKeys, indices] = await Promise.all([
      this.executeSQL<{ name: string, type: string, is_nullable: boolean }>(`
      SELECT 
        name, 
        type, 
        ${this.identifier('notnull')} = 0 AS is_nullable
      FROM PRAGMA_TABLE_INFO('${this.identifier(table)}')
    `),
      this.executeSQL<{ name: string, to_table: string, from_column: string, to_column: string }>(`
      SELECT 
        'fk_' || ${this.identifier(table)} || '_' || from AS name, 
        ${this.identifier('from')} as from_column, 
        ${this.identifier('to')} as to_column, 
        ${this.identifier('table')} as to_table
      FROM PRAGMA_FOREIGN_KEY_LIST('${this.identifier(table)}')
    `),
      this.executeSQL<{ name: string, is_unique: boolean, columns: string }>(`
      SELECT 
        il.name as name, 
        il.${this.identifier('unique')} = 1 as is_unique,  
        GROUP_CONCAT(ii.col_name) AS columns
      FROM PRAGMA_INDEX_LIST(${this.identifier(table)}) il
      JOIN PRAGMA_INDEX_INFO(il.name) ii
      GROUP BY 1, 2
    `)
    ]);
    return {
      columns: columns.records,
      foreignKeys: foreignKeys.records,
      indices: indices.records.map(idx => ({
        name: idx.name,
        is_unique: idx.is_unique,
        columns: idx.columns.split(',')
      }))
    };
  }

  /**
   * Define column modification
   */
  getModifyColumnSQL(stack: VisitStack[]): string {
    const field: SchemaFieldConfig = castTo(stack.at(-1));
    const type = this.getColumnType(field);
    const identifier = this.identifier(field.name);
    return `ALTER TABLE ${this.parentTable(stack)} ALTER COLUMN ${identifier} TYPE ${type} USING (${identifier}::${type});`;
  }

  /**
   * Generate truncate SQL
   */
  override getTruncateTableSQL(stack: VisitStack[]): string {
    return `DELETE FROM ${this.table(stack)};`;
  }

  override getDeleteSQL(stack: VisitStack[], where?: WhereClause<unknown>): string {
    return super.getDeleteSQL(stack, where).replace(/_ROOT[.]?/g, '');
  }

  override getUpdateSQL(stack: VisitStack[], data: Record<string, unknown>, where?: WhereClause<unknown>): string {
    return super.getUpdateSQL(stack, data, where).replace(/_ROOT[.]?/g, '');
  }
}