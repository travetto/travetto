import { type Pool, type PoolClient, default as pg } from 'pg';

import type { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { ExistsError } from '@travetto/model';
import { SQLConnection } from '@travetto/model-sql';
import { castTo, ShutdownManager } from '@travetto/runtime';

import type { PostgresModelConfig } from './config.ts';
import { PostgresDialect } from './dialect.ts';

/**
 * PostgreSQL connection manager
 */
@Injectable()
export class PostgresConnection extends SQLConnection<PoolClient> {
  pool: Pool;

  readonly dialect = new PostgresDialect();
  readonly config: PostgresModelConfig;

  constructor(context: AsyncContext, config: PostgresModelConfig) {
    super(context);
    this.config = config;
  }

  /**
   * Initializes the pool and creates the pgcrypto extension
   */
  async init(): Promise<void> {
    this.pool = new pg.Pool({
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port,
      ...castTo({
        parseInputDatesAsUTC: true
      }),
      ...this.config.options
    });

    try {
      await this.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }

    ShutdownManager.signal.addEventListener('abort', () => this.pool.end());
  }

  /**
   * Acquires a client from the pool
   */
  acquire(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Releases a client back to the pool
   */
  release(connection: PoolClient): void {
    connection.release();
  }

  /**
   * Executes a query on the active client or pool directly
   */
  async execute<Type = unknown>(query: string, values?: unknown[]): Promise<{ count: number; records: Type[] }> {
    console.debug('Executing PostgreSQL query', { query, values });

    // Handle dynamically built savepoint names that cannot be parameterized in Postgres
    if (query.includes('SAVEPOINT') || query.includes('ROLLBACK TO') || query.includes('RELEASE SAVEPOINT')) {
      if (values && values.length > 0) {
        query = query.replace('$1', `"${values[0]}"`);
        values = [];
      }
    }

    const client = this.active ?? this.pool;

    try {
      const result = await client.query(query, values);
      const records: Type[] = [...result.rows].map(row => ({ ...row }));
      return { count: result.rowCount ?? 0, records };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? castTo<Record<string, unknown>>(error).code : undefined;
      switch (code) {
        case '42P07':
          throw new ExistsError('index', query);
        case '23505':
          throw new ExistsError('query', query);
        default:
          throw error;
      }
    }
  }
}
