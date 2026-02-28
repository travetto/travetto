import type { SchemaFieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import type { AsyncContext } from '@travetto/context';
import type { ModelType } from '@travetto/model';
import { castTo, type Class } from '@travetto/runtime';

import { SQLDialect, type SQLModelConfig, SQLModelUtil, type VisitStack, type SQLTableDescription } from '@travetto/model-sql';

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

  async describeTable(table: string): Promise<SQLTableDescription | undefined> {
    const IGNORE_FIELDS = [this.pathField.name, this.parentPathField.name, this.idxField.name].map(field => `'${field}'`);

    // 1. Columns
    const columns = await this.executeSQL<{ name: string, type: string, is_not_null: boolean }>(`
      SELECT
        a.attname AS name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
        a.attnotnull AS is_not_null
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN
        pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
      WHERE
        c.relname = '${table}'
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname NOT IN (${IGNORE_FIELDS.join(',')})
      ORDER BY
        a.attnum;
    `);

    if (!columns.count) {
      return undefined;
    }

    // 2. Foreign Keys
    const foreignKeys = await this.executeSQL<{ name: string, from_column: string, to_column: string, to_table: string }>(`
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
        AND tc.table_name = '${table}'
    `);

    // 3. Indices
    const indices = await this.executeSQL<{ name: string, is_unique: boolean, columns: string[] }>(`
      SELECT
        i.relname AS name,
        ix.indisunique AS is_unique,
        ARRAY_AGG(a.attname || ' '|| CAST((o.OPTION & 1) AS VARCHAR) ORDER BY array_position(ix.indkey, a.attnum)) AS columns
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      CROSS JOIN LATERAL UNNEST(ix.indkey)    WITH ordinality AS c (colnum, ordinality)
      LEFT  JOIN LATERAL UNNEST(ix.indoption) WITH ordinality AS o (OPTION, ordinality) ON c.ordinality = o.ordinality 
      LEFT JOIN pg_catalog.pg_constraint co ON co.conindid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.colnum 
      WHERE t.relname = '${table}'
        AND NOT ix.indisprimary
        AND co.conindid IS NULL
      GROUP BY i.relname, ix.indisunique
    `);

    return {
      columns: columns.records.map(col => ({
        ...col,
        type: col.type.toUpperCase()
          .replace('CHARACTER VARYING', 'VARCHAR')
          .replace('INTEGER', 'INT'),
        is_not_null: !!col.is_not_null
      })),
      foreignKeys: foreignKeys.records,
      indices: indices.records
        .map(idx => ({
          name: idx.name,
          is_unique: idx.is_unique,
          columns: idx.columns
            .map(column => column.split(' '))
            .map(([name, desc]) => ({ name, desc: desc === '1' }))
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