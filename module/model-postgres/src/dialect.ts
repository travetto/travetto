import { SchemaFieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { ModelType } from '@travetto/model';
import { castTo, Class } from '@travetto/runtime';

import { SQLDialect, SQLModelConfig, SQLModelUtil, VisitStack } from '@travetto/model-sql';

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