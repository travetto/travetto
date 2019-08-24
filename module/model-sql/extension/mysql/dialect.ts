import { FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WhereClause } from '@travetto/model';

import { SQLModelConfig, SQLDialect, VisitStack } from '../..';
import { MySQLConnection } from './connection';

@Injectable({
  target: SQLDialect
})
export class MySQLDialect extends SQLDialect {

  conn: MySQLConnection;
  tablePostfix = `COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB`;
  ns: string;

  constructor(context: AsyncContext, public config: SQLModelConfig) {
    super(config.namespace);
    this.conn = new MySQLConnection(context, config);

    Object.assign(this.SQL_OPS, {
      $regex: 'REGEXP BINARY',
      $iregex: 'REGEXP'
    });

    Object.assign(this.COLUMN_TYPES, {
      TIMESTAMP: 'DATETIME',
      JSON: 'TEXT'
    });

    this.regexWordBoundary = '([[:<:]]|[[:>:]])';
    this.idField.minlength = this.idField.maxlength = { n: this.KEY_LEN };

    if (/^5[.][56]/.test(this.config.version)) {
      this.DEFAULT_STRING_LEN = 191; // Mysql limitation with utf8 and keys
    }
  }

  hash(value: string) {
    return `SHA2('${value}', ${this.KEY_LEN * 4})`;
  }

  ident(field: FieldConfig | string) {
    return `\`${typeof field === 'string' ? field : field.name}\``;
  }

  getCreateTableSQL(stack: VisitStack[]) {
    return super.getCreateTableSQL(stack).replace(/;$/, ` ${this.tablePostfix};`);
  }

  /**
   * Simple query execution
   */
  async executeSQL<T = any>(query: string): Promise<{ count: number, records: T[] }> {
    return new Promise<{ count: number, records: T[] }>((res, rej) => {
      (console as any).trace(`\n${'-'.repeat(20)} \nExecuting query\n`, query, '\n', '-'.repeat(20));
      this.conn.active.query(query, (err, results, fields) => {
        if (err) {
          console.debug(err);
          rej(err);
        } else {
          const records = Array.isArray(results) ? [...results].map(v => ({ ...v })) : [{ ...results }] as T[];
          res({ records, count: results.affectedRows });
        }
      });
    });
  }

  getModifyColumnSQL(stack: VisitStack[]) {
    const field = stack[stack.length - 1];
    return `ALTER TABLE ${this.parentTable(stack)} MODIFY COLUMN ${this.getColumnDefinition(field as FieldConfig)};`;
  }

  getDeleteSQL(stack: VisitStack[], where?: WhereClause<any>) {
    const sql = super.getDeleteSQL(stack, where);
    return sql.replace(/\bDELETE\b/g, `DELETE ${this.rootAlias}`);
  }
}