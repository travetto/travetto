import * as pg from 'pg';

import { ShutdownManager } from '@travetto/base';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';

import { SQLModelConfig, Connection } from '@travetto/model-sql';

/**
 * Connection support for postgresql
 */
export class PostgreSQLConnection extends Connection<pg.PoolClient> {

  #pool: pg.Pool;
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
      parseInputDatesAsUTC: true,
      ...(this.#config.options || {})
    });

    await this.runWithActive(() =>
      this.runWithTransaction('required', () =>
        this.execute(this.active, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;')
      )
    );

    // Close postgres
    ShutdownManager.onShutdown(this.constructor.Ⲑid, () => this.#pool.end());
  }

  async execute<T = unknown>(conn: pg.PoolClient, query: string): Promise<{ count: number, records: T[] }> {
    console.debug('Executing query', { query });
    try {
      const out = await conn.query(query);
      const records: T[] = [...out.rows].map(v => ({ ...v }));
      return { count: out.rowCount, records };
    } catch (err) {
      if (err instanceof Error && err.message.includes('duplicate key value')) {
        throw new ExistsError('query', query);
      } else {
        throw err;
      }
    }
  }

  acquire(): Promise<pg.PoolClient> {
    return this.#pool.connect();
  }

  release(conn: pg.PoolClient): void {
    conn.release();
  }
}