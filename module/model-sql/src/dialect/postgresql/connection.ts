// @file-if pg
import * as pg from 'pg';

import { ShutdownManager } from '@travetto/base';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';

import { Connection } from '../../connection/base';
import { SQLModelConfig } from '../../config';

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
  async init() {
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
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.#pool.end());
  }

  async execute<T = unknown>(conn: pg.PoolClient, query: string): Promise<{ count: number, records: T[] }> {
    console.debug('Executing query', { query });
    try {
      const out = await conn.query(query);
      return { count: out.rowCount, records: [...out.rows].map(v => ({ ...v })) as T[] };
    } catch (err) {
      if (err.message.includes('duplicate key value')) {
        throw new ExistsError('query', query);
      } else {
        throw err;
      }
    }
  }

  acquire() {
    return this.#pool.connect();
  }

  release(conn: pg.PoolClient) {
    conn.release();
  }
}