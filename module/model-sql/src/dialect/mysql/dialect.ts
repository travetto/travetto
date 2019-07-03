import * as mysql from 'mysql';

import { FieldConfig, BindUtil } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { SQLModelConfig } from '../../config';
import { SQLDialect } from '../base';
import { MySQLConnection } from './connection';

@Injectable({
  target: SQLDialect
})
export class MySQLDialect extends SQLDialect {

  conn: MySQLConnection;

  constructor(context: AsyncContext, public config: SQLModelConfig) {
    super(context, config.namespace);
    this.conn = new MySQLConnection(context, config);
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
        return `'${BindUtil.extractRegex(value).source}'`;
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

  createTableSQL(name: string, fields: FieldConfig[], suffix?: string) {
    const query = super.createTableSQL(name, fields, suffix);
    return query.replace(/;$/, `COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB;`);
  }

  /**
   * Simple query execution
   */
  async executeSQL<T = any>(query: string | mysql.QueryOptions): Promise<T> {
    return new Promise<T>((res, rej) => {
      (console as any).trace(`\n${'-'.repeat(20)}\nExecuting query\n`, query, '\n', '-'.repeat(20));
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
}