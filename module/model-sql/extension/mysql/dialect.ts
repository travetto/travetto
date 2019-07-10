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

    this.regexWordBoundary = '([[:<:]]|[[:>:]])';
  }

  hash(value: string) {
    return `SHA2('${value}', ${this.KEY_LEN * 4})`;
  }

  getCreateTableSQL(stack: VisitStack[]) {
    return super.getCreateTableSQL(stack).replace(/;$/, `${this.tablePostfix};`);
  }

  getColumnDefinition(field: FieldConfig) {
    return super.getColumnDefinition(field)
      .replace(/\bVARCHAR\b/g, 'NVARCHAR')
      .replace(/\bTIMESTAMP\b/g, 'DATETIME');
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
    return `ALTER TABLE ${this.namespaceParent(stack)} MODIFY COLUMN ${this.getColumnDefinition(field as FieldConfig)};`;
  }

  getDeleteSQL(stack: VisitStack[], where?: WhereClause<any>) {
    const sql = super.getDeleteSQL(stack, where);
    return sql.replace(/\bDELETE\b/g, `DELETE ${this.rootAlias}`);
  }
}