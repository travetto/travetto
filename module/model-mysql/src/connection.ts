import mysql, { OkPacket, ResultSetHeader } from 'mysql2';

import { ShutdownManager } from '@travetto/base';
import { AsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { Connection, SQLModelConfig } from '@travetto/model-sql';

function isSimplePacket(o: unknown): o is OkPacket | ResultSetHeader {
  return o !== null && o !== undefined && typeof o === 'object' && 'constructor' in o && (
    o.constructor.name === 'OkPacket' || o.constructor.name === 'ResultSetHeader'
  );
}

/**
 * Connection support for mysql
 */
export class MySQLConnection extends Connection<mysql.PoolConnection> {

  #pool: mysql.Pool;
  #config: SQLModelConfig;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig
  ) {
    super(context);
    this.#config = config;
  }

  async init(): Promise<void> {
    this.#pool = mysql.createPool({
      user: this.#config.user,
      password: this.#config.password,
      database: this.#config.database,
      host: this.#config.host,
      port: this.#config.port,
      timezone: '+00:00',
      typeCast: this.typeCast.bind(this),
      ...(this.#config.options || {})
    });

    // Close mysql
    ShutdownManager.onShutdown(this, () => new Promise(r => this.#pool.end(r)));
  }

  /**
   * Support some basic type support for JSON data
   */
  typeCast(field: unknown, next: () => unknown): unknown {
    const res = next();
    if (typeof res === 'string' && (field && typeof field === 'object' && 'type' in field) && (field.type === 'JSON' || field.type === 'BLOB')) {
      if (res.charAt(0) === '{' && res.charAt(res.length - 1) === '}') {
        try {
          return JSON.parse(res);
        } catch { }
      }
    }
    return res;
  }

  async execute<T = unknown>(conn: mysql.Connection, query: string): Promise<{ count: number, records: T[] }> {
    return new Promise<{ count: number, records: T[] }>((res, rej) => {
      console.debug('Executing Query', { query });
      conn.query(query, (err, results, fields) => {
        if (err) {
          console.debug('Failed query', { error: err, query });
          if (err.message.startsWith('Duplicate entry')) {
            rej(new ExistsError('query', query));
          } else {
            rej(err);
          }
        } else {
          if (isSimplePacket(results)) {
            return res({ records: [], count: results.affectedRows });
          } else {
            if (isSimplePacket(results[0])) {
              return res({ records: [], count: results[0].affectedRows });
            }
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const records: T[] = [...results].map(v => ({ ...v }) as T);
            return res({ records, count: records.length });
          }
        }
      });
    });
  }

  acquire(): Promise<mysql.PoolConnection> {
    return new Promise<mysql.PoolConnection>((res, rej) =>
      this.#pool.getConnection((err, conn) => err ? rej(err) : res(conn)));
  }

  release(conn: mysql.PoolConnection): void {
    conn.release();
  }
}