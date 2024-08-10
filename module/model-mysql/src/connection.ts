import { createPool } from 'mysql2';

import { castTo, ShutdownManager } from '@travetto/runtime';
import { AsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { Connection, SQLModelConfig } from '@travetto/model-sql';
import { PoolConnection, Pool, OkPacket, ResultSetHeader } from 'mysql2/promise';

function isSimplePacket(o: unknown): o is OkPacket | ResultSetHeader {
  return o !== null && o !== undefined && typeof o === 'object' && 'constructor' in o && (
    o.constructor.name === 'OkPacket' || o.constructor.name === 'ResultSetHeader'
  );
}

/**
 * Connection support for mysql
 */
export class MySQLConnection extends Connection<PoolConnection> {

  #pool: Pool;
  #config: SQLModelConfig;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig
  ) {
    super(context);
    this.#config = config;
  }

  async init(): Promise<void> {
    this.#pool = createPool({
      user: this.#config.user,
      password: this.#config.password,
      database: this.#config.database,
      host: this.#config.host,
      port: this.#config.port,
      timezone: '+00:00',
      typeCast: this.typeCast.bind(this),
      ...(this.#config.options || {})
    }).promise();

    // Close mysql
    ShutdownManager.onGracefulShutdown(() => this.#pool.end(), this);
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

  async execute<T = unknown>(conn: PoolConnection, query: string): Promise<{ count: number, records: T[] }> {
    console.debug('Executing Query', { query });
    try {
      const [results,] = await conn.query(query);
      if (isSimplePacket(results)) {
        return { records: [], count: results.affectedRows };
      } else {
        if (isSimplePacket(results[0])) {
          return { records: [], count: results[0].affectedRows };
        }
        const records: T[] = [...results].map(v => castTo({ ...v }));
        return { records, count: records.length };
      }
    } catch (err) {
      console.debug('Failed query', { error: err, query });
      if (err instanceof Error && err.message.startsWith('Duplicate entry')) {
        throw new ExistsError('query', query);
      } else {
        throw err;
      }
    }
  }

  acquire(): Promise<PoolConnection> {
    return this.#pool.getConnection();
  }

  release(conn: PoolConnection): void {
    conn.release();
  }
}