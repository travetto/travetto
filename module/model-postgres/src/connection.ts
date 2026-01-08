import { type Pool, type PoolClient, default as pg } from 'pg';

import { castTo, ShutdownManager } from '@travetto/runtime';
import { type AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { type SQLModelConfig, Connection } from '@travetto/model-sql';

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
        this.execute(this.active!, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;').catch(error => {
          if (!(error instanceof Error && error.message.includes('already exists'))) {
            throw error;
          }
        })
      )
    );

    // Close postgres
    ShutdownManager.onGracefulShutdown(() => this.#pool.end());
  }

  async execute<T = unknown>(pool: PoolClient, query: string, values?: unknown[]): Promise<{ count: number, records: T[] }> {
    console.debug('Executing query', { query });
    try {
      const out = await pool.query(query, values);
      const records: T[] = [...out.rows].map(value => ({ ...value }));
      return { count: out.rowCount!, records };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      switch (code) {
        // Index already exists
        case '42P07': throw new ExistsError('index', query);
        // Unique violation
        case '23505': throw new ExistsError('query', query);
        default: throw error;
      }
    }
  }

  acquire(): Promise<PoolClient> {
    return this.#pool.connect();
  }

  release(pool: PoolClient): void {
    pool.release();
  }
}