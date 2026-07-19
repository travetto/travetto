import { default as pg } from 'pg';

import { type AsyncContext, AsyncContextValue } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { ExistsError } from '@travetto/model';
import { type AsyncMethodDescriptor, castTo, ShutdownManager, Util } from '@travetto/runtime';

import type { PostgresJsonModelConfig } from './config.ts';

export type TransactionType = 'required' | 'isolated' | 'force';

export interface ConnectionAware {
  connection: PostgresJsonConnection;
}

/**
 * Decorator to ensure a method runs inside a database transaction
 */
export function Transactional(mode: TransactionType = 'required') {
  return function <Target extends ConnectionAware>(target: Target, property: string, descriptor: AsyncMethodDescriptor<Target>): void {
    const originalMethod = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof originalMethod> {
      return this.connection.runWithTransaction(mode, () => originalMethod.call(this, ...args));
    };
  };
}

/**
 * Connection manager for Postgres JSON Model service.
 * Operates directly on pg.Pool by default. If a transaction is active, runs queries on the transaction client.
 */
@Injectable()
export class PostgresJsonConnection {
  isolatedTransactions = true;
  nestedTransactions = true;

  transactionDialect = {
    begin: 'BEGIN;',
    beginNested: 'SAVEPOINT $1;',
    isolate: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
    rollback: 'ROLLBACK;',
    rollbackNested: 'ROLLBACK TO $1;',
    commit: 'COMMIT;',
    commitNested: 'RELEASE SAVEPOINT $1;'
  };

  pool: pg.Pool;
  readonly config: PostgresJsonModelConfig;
  readonly context: AsyncContext;

  #activeConnection = new AsyncContextValue<pg.PoolClient>(this, { failIfUnbound: { read: false } });
  #activeTransaction = new AsyncContextValue<boolean>(this, { failIfUnbound: { read: false } });

  constructor(context: AsyncContext, config: PostgresJsonModelConfig) {
    this.context = context;
    this.config = config;
  }

  get active(): pg.PoolClient | undefined {
    return this.#activeConnection.get();
  }

  get activeTransaction(): boolean {
    return !!this.#activeTransaction.get();
  }

  /**
   * Initializes the connection pool and enables pgcrypto extension if missing
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
      ...(this.config.options || {})
    });

    try {
      await this.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }

    // End pool connection on application shutdown
    ShutdownManager.signal.addEventListener('abort', () => this.pool.end());
  }

  /**
   * Acquires a client connection from the pool
   */
  acquire(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  /**
   * Releases a client connection back to the pool
   */
  release(connection: pg.PoolClient): void {
    connection.release();
  }

  /**
   * Executes a SQL query using the active transaction connection or pool directly
   */
  async execute<Type = unknown>(query: string, values?: unknown[]): Promise<{ count: number; records: Type[] }> {
    console.debug('Executing PostgreSQL query', { query, values });

    // Handle dynamically built savepoint names that can't be parameterized
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
        // Class 42: Syntax Error or Access Rule Violation (e.g. index/table already exists)
        case '42P07':
          throw new ExistsError('index', query);
        // Class 23: Integrity Constraint Violation (unique key violation)
        case '23505':
          throw new ExistsError('query', query);
        default:
          throw error;
      }
    }
  }

  /**
   * Runs an operation within a database transaction context
   */
  async runWithTransaction<Result>(mode: TransactionType, operation: () => Promise<Result>): Promise<Result> {
    if (this.activeTransaction) {
      if (mode === 'isolated' || mode === 'force') {
        const transactionId = mode === 'isolated' ? `tx${Util.uuid()}` : undefined;
        try {
          await this.startTransaction(this.active!, transactionId);
          const result = await operation();
          await this.commitTransaction(this.active!, transactionId);
          return result;
        } catch (error) {
          try {
            await this.rollbackTransaction(this.active!, transactionId);
          } catch {}
          throw error;
        }
      } else {
        return await operation();
      }
    } else {
      return this.context.run(async () => {
        let connection: pg.PoolClient | undefined;
        try {
          connection = await this.acquire();
          this.#activeConnection.set(connection);
          this.#activeTransaction.set(true);

          if (this.isolatedTransactions) {
            await this.execute(this.transactionDialect.isolate);
          }
          await this.execute(this.transactionDialect.begin);

          const result = await operation();

          await this.execute(this.transactionDialect.commit);
          return result;
        } catch (error) {
          if (connection) {
            try {
              await this.execute(this.transactionDialect.rollback);
            } catch {}
          }
          throw error;
        } finally {
          if (connection) {
            this.release(connection);
          }
        }
      });
    }
  }

  /**
   * Starts a transaction or creates a savepoint for nested transactions
   */
  async startTransaction(connection: pg.PoolClient, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(this.transactionDialect.beginNested, [transactionId]);
      }
    } else {
      if (this.isolatedTransactions) {
        await this.execute(this.transactionDialect.isolate);
      }
      await this.execute(this.transactionDialect.begin);
    }
  }

  /**
   * Commits the active transaction or releases a savepoint
   */
  async commitTransaction(connection: pg.PoolClient, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(this.transactionDialect.commitNested, [transactionId]);
      }
    } else {
      await this.execute(this.transactionDialect.commit);
    }
  }

  /**
   * Rolls back the active transaction or savepoint
   */
  async rollbackTransaction(connection: pg.PoolClient, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.isolatedTransactions) {
        await this.execute(this.transactionDialect.rollbackNested, [transactionId]);
      }
    } else {
      await this.execute(this.transactionDialect.rollback);
    }
  }
}
