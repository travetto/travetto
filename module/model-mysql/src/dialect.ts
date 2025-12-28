import { SchemaFieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WhereClause } from '@travetto/model-query';
import { castTo, Class } from '@travetto/runtime';
import { ModelType } from '@travetto/model';
import { SQLModelConfig, SQLDialect, VisitStack, type SQLTableDescription } from '@travetto/model-sql';

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

  async describeTable(table: string): Promise<SQLTableDescription | undefined> {
    const [columns, foreignKeys, indices] = await Promise.all([
      // 1. Columns
      this.executeSQL<{ name: string, type: string, is_nullable: boolean }>(`
      SELECT 
        COLUMN_NAME AS name, 
        COLUMN_TYPE AS type, 
        IS_NULLABLE = 'YES' AS is_nullable
      FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = '${this.identifier(table)}' 
      AND TABLE_SCHEMA = DATABASE()
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
      WHERE TABLE_NAME = '${this.identifier(table)}' 
      AND TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `),

      // 3. Indices
      this.executeSQL<{ name: string, is_unique: boolean, columns: string }>(`
      SELECT 
        INDEX_NAME AS name, 
        NON_UNIQUE = 0 AS is_unique, 
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
      FROM information_schema.STATISTICS
      WHERE TABLE_NAME = '${this.identifier(table)}' 
      AND TABLE_SCHEMA = DATABASE()
      GROUP BY INDEX_NAME, NON_UNIQUE
    `)
    ]);

    if (!columns.count) {
      return undefined;
    }

    return {
      columns: columns.records,
      foreignKeys: foreignKeys.records,
      indices: indices.records.map(idx => ({
        name: idx.name,
        is_unique: Boolean(idx.is_unique),
        columns: idx.columns.split(',')
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