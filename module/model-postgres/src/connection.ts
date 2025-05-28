import { type Pool, type PoolClient, default as pg } from 'pg';

import { LOG_LOCATION, castTo, ShutdownManager } from '@travetto/runtime';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { SQLModelConfig, Connection } from '@travetto/model-sql';

/**
 * Connection support for postgresql
 */
export class PostgreSQLConnection extends Connection<PoolClient> {

  #pool: Pool;
  #config: SQLModelConfig;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig
  ) {
    super(context);
    this.#config = config;
  }

  /**
   * Initializes connection and establishes crypto extension for use with hashing
   */
  @WithAsyncContext()
  async init(): Promise<void> {
    this.#pool = new pg.Pool({
      user: this.#config.user,
      password: this.#config.password,
      database: this.#config.database,
      host: this.#config.host,
      port: this.#config.port,
      ...castTo({
        parseInputDatesAsUTC: true,
      }),
      ...(this.#config.options || {})
    });

    await this.runWithActive(() =>
      this.runWithTransaction('required', () =>
        this.execute(this.active!, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;')
      )
    );

    // Close postgres
    ShutdownManager.onGracefulShutdown(() => this.#pool.end(), LOG_LOCATION());
  }

  async execute<T = unknown>(conn: PoolClient, query: string, values?: unknown[]): Promise<{ count: number, records: T[] }> {
    console.debug('Executing query', { query });
    try {
      const out = await conn.query(query, values);
      const records: T[] = [...out.rows].map(v => ({ ...v }));
      return { count: out.rowCount!, records };
    } catch (err) {
      if (err instanceof Error && err.message.includes('duplicate key value')) {
        throw new ExistsError('query', query);
      } else {
        throw err;
      }
    }
  }

  acquire(): Promise<PoolClient> {
    return this.#pool.connect();
  }

  release(conn: PoolClient): void {
    conn.release();
  }
}