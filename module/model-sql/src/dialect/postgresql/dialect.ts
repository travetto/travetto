// @file-if pg
import { FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { ModelType } from '@travetto/model';
import { Class } from '@travetto/base';


import { SQLModelConfig } from '../../config';
import { SQLDialect } from '../base';
import { SQLUtil, VisitStack } from '../../internal/util';
import { PostgreSQLConnection } from './connection';
/**
 * Postgresql Dialect for the SQL Model Source
 */
@Injectable()
export class PostgreSQLDialect extends SQLDialect {

  conn: PostgreSQLConnection;
  ns: string;

  constructor(context: AsyncContext, public config: SQLModelConfig) {
    super(config.namespace);
    this.conn = new PostgreSQLConnection(context, config);

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
  hash(value: string) {
    return `encode(digest('${value}', 'sha1'), 'hex')`;
  }

  ident(field: FieldConfig | string) {
    return `"${typeof field === 'string' ? field : field.name}"`;
  }

  /**
   * Define column modification
   */
  getModifyColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    const type = this.getColumnType(field as FieldConfig);
    const ident = this.ident(field.name);
    return `ALTER TABLE ${this.parentTable(stack)} ALTER COLUMN ${ident}  TYPE ${type} USING (${ident}::${type});`;
  }

  /**
   * Generate truncate SQL
   */
  getTruncateTableSQL(stack: VisitStack[]) {
    return `TRUNCATE ${this.table(stack)} CASCADE; `;
  }

  /**
   * Suppress foreign key checks
   */
  getTruncateAllTablesSQL<T extends ModelType>(cls: Class<T>): string[] {
    return [this.getTruncateTableSQL(SQLUtil.classToStack(cls))];
  }
}