import type { SchemaFieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import type { AsyncContext } from '@travetto/context';
import type { WhereClause } from '@travetto/model-query';
import { castTo, type Class } from '@travetto/runtime';
import type { ModelType, IndexConfig } from '@travetto/model';
import { type SQLModelConfig, SQLDialect, type VisitStack, type SQLTableDescription, SQLModelUtil } from '@travetto/model-sql';

import { MySQLConnection } from './connection.ts';

/**
 * MYSQL Dialect for the SQL Model Source
 */
@Injectable()
export class MySQLDialect extends SQLDialect {

  connection: MySQLConnection;
  tablePostfix = 'COLLATE=utf8mb4_bin ENGINE=InnoDB';

  constructor(context: AsyncContext, config: SQLModelConfig) {
    super(config.namespace);
    this.connection = new MySQLConnection(context, config);

    // Custom types
    Object.assign(this.COLUMN_TYPES, {
      TIMESTAMP: 'DATETIME(3)',
      JSON: 'TEXT'
    });

    /**
     * Set string length limit based on version
     */
    if (/^5[.][56]/.test(config.version)) {
      this.DEFAULT_STRING_LENGTH = 191; // Mysql limitation with utf8 and keys
    } else {
      this.DEFAULT_STRING_LENGTH = 3072 / 4 - 1;
    }

    if (/^5[.].*/.test(config.version)) {
      // Customer operators
      Object.assign(this.SQL_OPS, {
        $regex: 'REGEXP BINARY',
        $iregex: 'REGEXP'
      });

      this.regexWordBoundary = '([[:<:]]|[[:>:]])';
    } else {
      // Customer operators
      Object.assign(this.SQL_OPS, {
        $regex: 'REGEXP',
      });
      // Double escape
      this.regexWordBoundary = '\\\\b';
    }
  }

  /**
   * Compute hash
   */
  hash(value: string): string {
    return `SHA2('${value}', '256')`;
  }

  /**
   * Get DROP INDEX sql
   */
  getDropIndexSQL<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string): string {
    const constraint = typeof idx === 'string' ? idx : this.getIndexName(cls, idx);
    return `DROP INDEX ${this.identifier(constraint)} ON ${this.table(SQLModelUtil.classToStack(cls))};`;
  }

  async describeTable(table: string): Promise<SQLTableDescription | undefined> {
    const IGNORE_FIELDS = [this.pathField.name, this.parentPathField.name, this.idxField.name].map(field => `'${field}'`);
    const [columns, foreignKeys, indices] = await Promise.all([
      // 1. Columns
      this.executeSQL<{ name: string, type: string, is_not_null: boolean }>(`
      SELECT 
        COLUMN_NAME AS name, 
        COLUMN_TYPE AS type, 
        IS_NULLABLE <> 'YES' AS is_not_null
      FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = '${table}' 
      AND TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME NOT IN (${IGNORE_FIELDS.join(',')})
      ORDER BY ORDINAL_POSITION
    `),

      // 2. Foreign Keys
      this.executeSQL<{ name: string, from_column: string, to_column: string, to_table: string }>(`
      SELECT 
        CONSTRAINT_NAME AS name, 
        COLUMN_NAME AS from_column, 
        REFERENCED_COLUMN_NAME AS to_column, 
        REFERENCED_TABLE_NAME AS to_table
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = '${table}' 
      AND TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `),

      // 3. Indices
      this.executeSQL<{ name: string, is_unique: number, columns: string }>(`
      SELECT 
        stat.INDEX_NAME AS name, 
        stat.NON_UNIQUE = 0 AS is_unique, 
        GROUP_CONCAT(CONCAT(stat.COLUMN_NAME, ' ', stat.COLLATION, ' ') ORDER BY stat.SEQ_IN_INDEX) AS columns
      FROM information_schema.STATISTICS stat
      LEFT OUTER JOIN information_schema.TABLE_CONSTRAINTS AS tc
        ON tc.CONSTRAINT_NAME = stat.INDEX_NAME
        AND tc.TABLE_NAME = stat.TABLE_NAME
        AND tc.TABLE_SCHEMA = stat.TABLE_SCHEMA
      WHERE 
        stat.TABLE_NAME = '${table}' 
        AND stat.TABLE_SCHEMA = DATABASE()
        AND tc.CONSTRAINT_TYPE IS NULL
        AND stat.COLUMN_NAME NOT IN (${IGNORE_FIELDS.join(',')})
      GROUP BY stat.INDEX_NAME, stat.NON_UNIQUE
    `)
    ]);

    if (!columns.count) {
      return undefined;
    }

    return {
      columns: columns.records.map(col => ({
        ...col,
        type: col.type.toUpperCase(),
        is_not_null: !!col.is_not_null
      })),
      foreignKeys: foreignKeys.records,
      indices: indices.records.map(idx => ({
        name: idx.name,
        is_unique: !!idx.is_unique,
        columns: idx.columns
          .split(',')
          .map(column => column.split(' '))
          .map(([name, desc]) => ({ name, desc: desc === 'D' }))
      }))
    };
  }

  /**
   * Create table, adding in specific engine options
   */
  override getCreateTableSQL(stack: VisitStack[]): string {
    return super.getCreateTableSQL(stack).replace(/;$/, ` ${this.tablePostfix};`);
  }

  /**
   * Define column modification
   */
  getModifyColumnSQL(stack: VisitStack[]): string {
    const field: SchemaFieldConfig = castTo(stack.at(-1));
    return `ALTER TABLE ${this.parentTable(stack)} MODIFY COLUMN ${this.getColumnDefinition(field)};`;
  }

  /**
   * Add root alias to delete clause
   */
  override getDeleteSQL(stack: VisitStack[], where?: WhereClause<unknown>): string {
    const sql = super.getDeleteSQL(stack, where);
    return sql.replace(/\bDELETE\b/g, `DELETE ${this.rootAlias}`);
  }

  /**
   * Suppress foreign key checks
   */
  override getTruncateAllTablesSQL<T extends ModelType>(cls: Class<T>): string[] {
    return [
      'SET FOREIGN_KEY_CHECKS = 0;',
      ...super.getTruncateAllTablesSQL(cls),
      'SET FOREIGN_KEY_CHECKS = 1;'
    ];
  }
}