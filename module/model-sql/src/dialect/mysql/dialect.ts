import * as mysql from 'mysql';

import { FieldConfig, BindUtil } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { Class } from '@travetto/registry';
import { Query } from '@travetto/model';

import { SQLModelConfig } from '../../config';
import { SQLDialect } from '../dialect';
import { MySQLConnection } from './connection';
import { VisitStack, SQLUtil } from '../../util';
import { Dialect } from '../../types';

@Injectable({
  target: SQLDialect
})
export class MySQLDialect extends SQLDialect implements Dialect {

  conn: MySQLConnection;
  tablePostfix = `COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB`;
  ns: string;

  constructor(context: AsyncContext, public config: SQLModelConfig) {
    super();
    this.conn = new MySQLConnection(context, config);
    this.ns = config.namespace;
  }

  hash(value: string) {
    return `SHA2('${value}', ${this.KEY_LEN * 4})`;
  }

  getCreateTableSQL(stack: VisitStack[]) {
    return super.getCreateTableSQL(stack).replace(/[)];$/, `) ${this.tablePostfix};`);
  }

  /**
   * FieldConfig to MySQL Column definition
   */
  getColumnDefinition(conf: FieldConfig) {
    let type: string = '';

    if (conf.type === Number) {
      type = 'INT';
      if (conf.precision) {
        const [digits, decimals] = conf.precision;
        if (decimals) {
          type = `DECIMAL(${digits}, ${decimals})`;
        } else if (digits) {
          if (digits < 3) {
            type = 'TINYINT';
          } else if (digits < 5) {
            type = 'SMALLINT';
          } else if (digits < 7) {
            type = 'MEDIUMINIT';
          } else if (digits < 10) {
            type = 'INT';
          } else {
            type = 'BIGINT';
          }
        }
      } else {
        type = 'INTEGER';
      }
    } else if (conf.type === Date) {
      type = 'DATETIME';
    } else if (conf.type === Boolean) {
      type = 'BOOL';
    } else if (conf.type === String) {
      if (conf.specifier && conf.specifier.startsWith('text')) {
        type = 'TEXT';
      } else {
        type = `NVARCHAR(${conf.maxlength ? conf.maxlength.n : 1024})`;
      }
    }

    if (!type) {
      return '';
    }

    return `${conf.name} ${type} ${conf.required && conf.required.active ? 'NOT NULL' : 'DEFAULT NULL'}`;
  }

  /**
   * Convert value to SQL valid representation
   */
  resolveValue(conf: FieldConfig, value: any) {
    if (value === undefined || value === null) {
      return 'NULL';
    } else if (conf.type === String) {
      if (value instanceof RegExp) {
        const src = BindUtil.extractRegex(value).source.replace(/\\b/g, '([[:<:]]|[[:>:]])');
        return `'${src}'`;
      } else {
        return `'${value}'`;
      }
    } else if (conf.type === Boolean) {
      return `'${value ? 'true' : 'false'}'`;
    } else if (conf.type === Number) {
      return `${value}`;
    } else if (conf.type === Date) {
      const [day, time] = (value as Date).toISOString().split(/[T.]/);
      return `'${day} ${time}'`;
    }
    throw new Error('Ruh roh?');
  }

  /**
   * Simple query execution
   */
  async executeSQL<T = any>(query: string | mysql.QueryOptions): Promise<T> {
    return new Promise<T>((res, rej) => {
      (console as any).trace(`\n${'-'.repeat(20)} \nExecuting query\n`, query, '\n', '-'.repeat(20));
      this.conn.active.query(query, (err, results, fields) => {
        if (err) {
          console.debug(err);
          rej(err);
        } else {
          res(Array.isArray(results) ? [...results].map(v => ({ ...v })) : { ...results });
        }
      });
    });
  }

  async deleteAndGetCount<T>(cls: Class<T>, query: Query<T>) {
    const res = await this.executeSQL<{ affectedRows: number }>(this.getDeleteSQL(SQLUtil.classToStack(cls), query.where));
    return res.affectedRows;
  }

  async getCountForQuery<T>(cls: Class<T>, query: Query<T>) {
    const { total } = await this.executeSQL<{ total: number }>(this.getQueryCountSQL(cls, query));
    return total;
  }
}