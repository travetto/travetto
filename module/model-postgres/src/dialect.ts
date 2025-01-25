import { FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { ModelType } from '@travetto/model';
import { castTo, Class } from '@travetto/runtime';

import { SQLDialect, SQLModelConfig } from '@travetto/model-sql';
import { SQLUtil, VisitStack } from '@travetto/model-sql/src/internal/util';

import { PostgreSQLConnection } from './connection';

/**
 * Postgresql Dialect for the SQL Model Source
 */
@Injectable()
export class PostgreSQLDialect extends SQLDialect {

  conn: PostgreSQLConnection;

  constructor(context: AsyncContext, config: SQLModelConfig) {
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
  hash(value: string): string {
    return `encode(digest('${value}', 'sha1'), 'hex')`;
  }

  ident(field: FieldConfig | string): string {
    return `"${typeof field === 'string' ? field : field.name}"`;
  }

  /**
   * Define column modification
   */
  getModifyColumnSQL(stack: VisitStack[]): string {
    const field: FieldConfig = castTo(stack[stack.length - 1]);
    const type = this.getColumnType(field);
    const ident = this.ident(field.name);
    return `ALTER TABLE ${this.parentTable(stack)} ALTER COLUMN ${ident}  TYPE ${type} USING (${ident}::${type});`;
  }

  /**
   * Suppress foreign key checks
   */
  override getTruncateAllTablesSQL<T extends ModelType>(cls: Class<T>): string[] {
    return [`TRUNCATE ${this.table(SQLUtil.classToStack(cls))} CASCADE;`];
  }
}