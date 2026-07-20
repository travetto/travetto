import { createPool } from 'mysql2';
import type { OkPacket, Pool, PoolConnection, ResultSetHeader, TypeCastField } from 'mysql2/promise';

import type { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { ExistsError } from '@travetto/model';
import { SQLConnection } from '@travetto/model-sql';
import { castTo, JSONUtil, ShutdownManager } from '@travetto/runtime';

import type { MysqlModelConfig } from './config.ts';

function isSimplePacket(value: unknown): value is OkPacket | ResultSetHeader {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'constructor' in value &&
    (value.constructor.name === 'OkPacket' || value.constructor.name === 'ResultSetHeader')
  );
}

/**
 * MySQL Connection Manager.
 * Operates on mysql2 promise Pool.
 */
@Injectable()
export class MysqlConnection extends SQLConnection<PoolConnection> {
  pool: Pool;
  readonly config: MysqlModelConfig;

  constructor(context: AsyncContext, config: MysqlModelConfig) {
    super(context);
    this.config = config;
  }

  /**
   * Initializes the mysql2 connection pool
   */
  async init(): Promise<void> {
    this.pool = createPool({
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port,
      supportBigNumbers: true,
      timezone: '+00:00',
      typeCast: this.typeCast.bind(this),
      ...(this.config.options || {})
    }).promise();

    ShutdownManager.signal.addEventListener('abort', () => this.pool.end());
  }

  /**
   * Typecasting parser for JSON and BLOB mysql columns
   */
  typeCast(field: TypeCastField, next: () => unknown): unknown {
    const result = next();
    switch (field.type) {
      case 'JSON':
      case 'BLOB': {
        if (typeof result === 'string' && result.charAt(0) === '{' && result.charAt(result.length - 1) === '}') {
          try {
            return JSONUtil.fromUTF8(result);
          } catch {}
        }
        break;
      }
    }
    return result;
  }

  /**
   * Acquires a PoolConnection from the pool
   */
  acquire(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  /**
   * Releases a PoolConnection back to the pool
   */
  release(connection: PoolConnection): void {
    connection.release();
  }

  /**
   * Executes a query on the active client or pool directly
   */
  async execute<Type = unknown>(query: string, values?: unknown[]): Promise<{ count: number; records: Type[] }> {
    console.debug('Executing MySQL query', { query, values });
    const client = this.active ?? (await this.acquire());
    try {
      const [results] = await client.execute({ sql: query, values });
      if (isSimplePacket(results)) {
        return { records: [], count: results.affectedRows };
      } else {
        if (isSimplePacket(results[0])) {
          return { records: [], count: results[0].affectedRows };
        }
        const records: Type[] = [...castTo<unknown[]>(results)].map(value => castTo({ ...castTo<object>(value) }));
        return { records, count: records.length };
      }
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      switch (code) {
        case 'ER_DUP_ENTRY':
          throw new ExistsError('query', query);
        case 'ER_DUP_KEYNAME':
          throw new ExistsError('index', query);
        default:
          throw error;
      }
    } finally {
      if (!this.active) {
        this.release(client);
      }
    }
  }
}
