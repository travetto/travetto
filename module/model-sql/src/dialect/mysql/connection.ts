// @file-if mysql
import * as mysql from 'mysql';

import { ShutdownManager } from '@travetto/base';
import { AsyncContext } from '@travetto/context';
import { Connection } from '../../connection/base';
import { SQLModelConfig } from '../../config';

/**
 * Connection support for mysql
 */
export class MySQLConnection extends Connection<mysql.PoolConnection> {

  pool: mysql.Pool;

  constructor(
    context: AsyncContext,
    private config: SQLModelConfig
  ) {
    super(context);
  }

  async init() {
    this.pool = mysql.createPool({
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port,
      typeCast: this.typeCast.bind(this),
      ...(this.config.options || {})
    });

    // Close mysql
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => new Promise(r => this.pool.end(r)));
  }

  /**
   * Support some basic type support for JSON data
   */
  typeCast(field: Parameters<Exclude<mysql.TypeCast, boolean>>[0], next: () => void) {
    const res: any = next();
    if (typeof res === 'string' && (field.type === 'JSON' || field.type === 'BLOB')) {
      if (res.charAt(0) === '{' && res.charAt(res.length - 1) === '}') {
        try {
          return (JSON.parse(res));
        } catch { }
      }
    }
    return res;
  }

  async execute<T = any>(conn: mysql.Connection, query: string): Promise<{ count: number, records: T[] }> {
    return new Promise<{ count: number, records: T[] }>((res, rej) => {
      console.debug('Executing Query', { query });
      conn.query(query, (err, results, fields) => {
        if (err) {
          console.debug('Failed query', { error: err });
          rej(err);
        } else {
          const records = Array.isArray(results) ? [...results].map(v => ({ ...v })) : [{ ...results }] as T[];
          res({ records, count: results.affectedRows });
        }
      });
    });
  }

  acquire() {
    return new Promise<mysql.PoolConnection>((res, rej) =>
      this.pool.getConnection((err, conn) => err ? rej(err) : res(conn)));
  }

  release(conn: mysql.PoolConnection) {
    conn.release();
  }
}