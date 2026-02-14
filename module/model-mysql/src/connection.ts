import { createPool } from 'mysql2';
import type { PoolConnection, Pool, OkPacket, ResultSetHeader, TypeCastField } from 'mysql2/promise';

import { castTo, JSONUtil, ShutdownManager } from '@travetto/runtime';
import type { AsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { Connection, type SQLModelConfig } from '@travetto/model-sql';

function isSimplePacket(value: unknown): value is OkPacket | ResultSetHeader {
  return value !== null && value !== undefined && typeof value === 'object' && 'constructor' in value && (
    value.constructor.name === 'OkPacket' || value.constructor.name === 'ResultSetHeader'
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
      supportBigNumbers: true,
      timezone: '+00:00',
      typeCast: this.typeCast.bind(this),
      ...(this.#config.options || {})
    }).promise();

    // Close mysql
    ShutdownManager.signal.addEventListener('abort', () => this.#pool.end());
  }

  /**
   * Support some basic type support for JSON data
   */
  typeCast(field: TypeCastField, next: () => unknown): unknown {
    const result = next();
    switch (field.type) {
      case 'JSON':
      case 'BLOB': {
        if (typeof result === 'string' && result.charAt(0) === '{' && result.charAt(result.length - 1) === '}') {
          try {
            return JSONUtil.fromUTF8(result);
          } catch { }
        }
        break;
      }
    }
    return result;
  }

  async execute<T = unknown>(pool: PoolConnection, query: string, values?: unknown[]): Promise<{ count: number, records: T[] }> {
    console.debug('Executing query', { query });
    let prepared;
    try {
      prepared = (values?.length ?? 0) > 0 ? await pool.prepare(query) : undefined;
      const [results,] = await (prepared ? prepared.execute(values) : pool.query(query));
      if (isSimplePacket(results)) {
        return { records: [], count: results.affectedRows };
      } else {
        if (isSimplePacket(results[0])) {
          return { records: [], count: results[0].affectedRows };
        }
        const records: T[] = [...results].map(value => castTo({ ...value }));
        return { records, count: records.length };
      }
    } catch (error) {
      console.debug('Failed query', { error, query });
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      switch (code) {
        case 'ER_DUP_ENTRY': throw new ExistsError('query', query);
        case 'ER_DUP_KEYNAME': throw new ExistsError('index', query);
        default: throw error;
      }
    } finally {
      try {
        await prepared?.close();
      } catch { }
    }
  }

  acquire(): Promise<PoolConnection> {
    return this.#pool.getConnection();
  }

  release(pool: PoolConnection): void {
    pool.release();
  }
}