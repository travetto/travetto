import { SchemaFieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { ModelType } from '@travetto/model';
import { castTo, Class } from '@travetto/runtime';

import { SQLDialect, SQLModelConfig, SQLModelUtil, VisitStack, type SQLTableDescription } from '@travetto/model-sql';

import { PostgreSQLConnection } from './connection.ts';

/**
 * Postgresql Dialect for the SQL Model Source
 */
@Injectable()
export class PostgreSQLDialect extends SQLDialect {

  connection: PostgreSQLConnection;

  constructor(context: AsyncContext, config: SQLModelConfig) {
    super(config.namespace);
    this.connection = new PostgreSQLConnection(context, config);
    this.ID_AFFIX = '"';

    // Special operators
    Object.assign(this.SQL_OPS, {
      $regex: '~',
      $iregex: '~*'
    });

    // Special types
    Object.assign(this.COLUMN_TYPES, {
      JSON: 'json',
      TIMESTAMP: 'TIMESTAMP(6) WITH TIME ZONE'
    });

    // Word boundary
    this.regexWordBoundary = '\\y';
  }

  /**
   * How to hash
   */
  hash(value: string): string {
    return `encode(digest('${value}', 'sha1'), 'hex')`;
  }


  async listAllTables(): Promise<string[]> {
    const results = await this.executeSQL<{ name: string }>(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
    return results.records.map(result => result.name);
  }

  async describeTable(table: string): Promise<SQLTableDescription> {
    const [columns, foreignKeys, indices] = await Promise.all([
      // 1. Columns
      this.executeSQL<{ name: string, type: string, is_nullable: boolean }>(`
      SELECT 
        column_name AS name, 
        data_type AS type, 
        (is_nullable = 'YES') AS is_nullable
      FROM information_schema.columns
      WHERE table_name = '${this.identifier(table)}'
      ORDER BY ordinal_position
    `),

      // 2. Foreign Keys
      this.executeSQL<{ name: string, from_column: string, to_column: string, to_table: string }>(`
      SELECT
        tc.constraint_name AS name, 
        kcu.column_name AS from_column,
        ccu.column_name AS to_column,
        ccu.table_name AS to_table
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = '${this.identifier(table)}'
    `),

      // 3. Indices
      this.executeSQL<{ name: string, is_unique: boolean, columns: string }>(`
      SELECT
        i.relname AS name,
        ix.indisunique AS is_unique,
        ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = '${this.identifier(table)}'
      GROUP BY i.relname, ix.indisunique
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
    return `ALTER TABLE ${this.parentTable(stack)} ALTER COLUMN ${identifier}  TYPE ${type} USING (${identifier}::${type});`;
  }

  /**
   * Suppress foreign key checks
   */
  override getTruncateAllTablesSQL<T extends ModelType>(cls: Class<T>): string[] {
    return [`TRUNCATE ${this.table(SQLModelUtil.classToStack(cls))} CASCADE;`];
  }
}