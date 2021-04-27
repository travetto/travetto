// @file-if better-sqlite3
import { FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WhereClause } from '@travetto/model-query';

import { SQLModelConfig } from '../../config';
import { SQLDialect } from '../base';
import { VisitStack } from '../../internal/util';
import { SqliteConnection } from './connection';

/**
 * Sqlite Dialect for the SQL Model Source
 */
@Injectable()
export class SqliteDialect extends SQLDialect {

  conn: SqliteConnection;

  constructor(context: AsyncContext, public config: SQLModelConfig) {
    super(config.namespace);
    this.conn = new SqliteConnection(context, config);

    // Special operators
    Object.assign(this.SQL_OPS, {
      $regex: 'REGEXP',
      $ilike: undefined
    });

    // Special types
    Object.assign(this.COLUMN_TYPES, {
      JSON: 'TEXT',
      TIMESTAMP: 'TEXT'
    });
  }

  /**
   * How to hash
   */
  hash(value: string) {
    return `hex('${value}')`;
  }

  /**
   * Build identifier
   */
  ident(field: FieldConfig | string) {
    return `\`${typeof field === 'string' ? field : field.name}\``;
  }

  /**
   * Define column modification
   */
  getModifyColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    const type = this.getColumnType(field as FieldConfig);
    const ident = this.ident(field.name);
    return `ALTER TABLE ${this.parentTable(stack)} ALTER COLUMN ${ident} TYPE ${type} USING (${ident}::${type});`;
  }

  /**
   * Generate truncate SQL
   */
  getTruncateTableSQL(stack: VisitStack[]) {
    return `DELETE FROM ${this.table(stack)};`;
  }

  getDeleteSQL(stack: VisitStack[], where?: WhereClause<unknown>): string {
    return super.getDeleteSQL(stack, where).replace(/_ROOT[.]?/g, '');
  }

  getUpdateSQL(stack: VisitStack[], data: Record<string, unknown>, where?: WhereClause<unknown>): string {
    return super.getUpdateSQL(stack, data, where).replace(/_ROOT[.]?/g, '');
  }
}