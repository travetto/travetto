// @file-if mysql
import { FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WhereClause } from '@travetto/model-query';
import { Class } from '@travetto/base';
import { ModelType } from '@travetto/model';

import { SQLModelConfig } from '../../config';
import { SQLDialect } from '../base';
import { VisitStack } from '../../internal/util';
import { MySQLConnection } from './connection';

/**
 * MYSQL Dialect for the SQL Model Source
 */
@Injectable()
export class MySQLDialect extends SQLDialect {

  conn: MySQLConnection;
  tablePostfix = "COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB";

  constructor(context: AsyncContext, public config: SQLModelConfig) {
    super(config.namespace);
    this.conn = new MySQLConnection(context, config);

    // Customer operators
    Object.assign(this.SQL_OPS, {
      $regex: 'REGEXP BINARY',
      $iregex: 'REGEXP'
    });

    // Custom types
    Object.assign(this.COLUMN_TYPES, {
      TIMESTAMP: 'DATETIME(3)',
      JSON: 'TEXT'
    });

    // Word boundary
    this.regexWordBoundary = '([[:<:]]|[[:>:]])';
    // Field maxlength
    this.idField.minlength = this.idField.maxlength = { n: this.KEY_LEN };

    /**
     * Set string length limit based on version
     */
    if (/^5[.][56]/.test(this.config.version)) {
      this.DEFAULT_STRING_LEN = 191; // Mysql limitation with utf8 and keys
    }
  }

  /**
   * Compute hash
   */
  hash(value: string): string {
    return `SHA2('${value}', ${this.KEY_LEN * 4})`;
  }

  /**
   * Build identifier
   */
  ident(field: FieldConfig | string): string {
    return `\`${typeof field === 'string' ? field : field.name}\``;
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const field = stack[stack.length - 1] as FieldConfig;
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