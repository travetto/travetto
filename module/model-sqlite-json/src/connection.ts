import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { createPool, type Pool } from 'generic-pool';

import { type AsyncContext, AsyncContextValue } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { ExistsError } from '@travetto/model';
import { type AsyncMethodDescriptor, castTo, Runtime, RuntimeError, ShutdownManager, Util } from '@travetto/runtime';

import type { SqliteJsonModelConfig } from './config.ts';

export type TransactionType = 'required' | 'isolated' | 'force';

export interface ConnectionAware {
  connection: SqliteJsonConnection;
}

const RECOVERABLE_MESSAGE = /database( table| schema)? is (locked|busy)/;

const isRecoverableError = (error: unknown): error is Error => error instanceof Error && RECOVERABLE_MESSAGE.test(error.message);

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
 * Connection manager for SQLite JSON Model service.
 * Operates on a single-writer connection pool.
 */
@Injectable()
export class SqliteJsonConnection {
  isolatedTransactions = false;
  nestedTransactions = true;

  transactionDialect = {
    begin: 'BEGIN IMMEDIATE;',
    beginNested: 'SAVEPOINT $1;',
    isolate: '',
    rollback: 'ROLLBACK;',
    rollbackNested: 'ROLLBACK TO $1;',
    commit: 'COMMIT;',
    commitNested: 'RELEASE SAVEPOINT $1;'
  };

  pool: Pool<DatabaseSync>;
  readonly config: SqliteJsonModelConfig;
  readonly context: AsyncContext;

  #activeConnection = new AsyncContextValue<DatabaseSync>(this, { failIfUnbound: { read: false } });
  #activeTransaction = new AsyncContextValue<boolean>(this, { failIfUnbound: { read: false } });

  constructor(context: AsyncContext, config: SqliteJsonModelConfig) {
    this.context = context;
    this.config = config;
  }

  get active(): DatabaseSync | undefined {
    return this.#activeConnection.get();
  }

  get activeTransaction(): boolean {
    return !!this.#activeTransaction.get();
  }

  async #withRetries<T>(operation: () => Promise<T>, retries = 10, delay = 250): Promise<T> {
    for (; retries > 1; retries -= 1) {
      try {
        return await operation();
      } catch (error) {
        if (isRecoverableError(error)) {
          await Util.blockingTimeout(delay);
        } else {
          throw error;
        }
      }
    }
    throw new RuntimeError('Max retries exceeded');
  }

  async #create(): Promise<DatabaseSync> {
    const file = path.resolve(this.config.file || Runtime.toolPath('@', 'sqlite_db'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file, this.config.options);

    for (const query of ['PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL', 'PRAGMA synchronous = NORMAL']) {
      await this.#withRetries(async () => database.exec(query));
    }

    // Register a RegExp helper function
    database.function('regexp', (pattern, value) => (new RegExp(`${pattern}`).test(`${value}`) ? 1 : 0));

    return database;
  }

  /**
   * Initializes the connection pool
   */
  async init(): Promise<void> {
    await this.#create();

    this.pool = createPool<DatabaseSync>(
      {
        create: () => this.#withRetries(() => this.#create()),
        destroy: async database => {
          database.close();
        }
      },
      { max: 1 }
    );

    // End pool connection on application shutdown
    ShutdownManager.signal.addEventListener('abort', () => this.pool.clear());
  }

  /**
   * Acquires a client connection from the pool
   */
  acquire(): Promise<DatabaseSync> {
    return this.pool.acquire();
  }

  /**
   * Releases a client connection back to the pool
   */
  release(connection: DatabaseSync): void {
    this.pool.release(connection);
  }

  /**
   * Executes a SQL query using the active connection or acquiring one from the pool
   */
  async execute<Type = unknown>(query: string, values?: unknown[]): Promise<{ count: number; records: Type[] }> {
    if (this.active) {
      return this.#executeWithConnection(this.active, query, values);
    } else {
      let connection: DatabaseSync | undefined;
      try {
        connection = await this.acquire();
        return await this.#executeWithConnection(connection, query, values);
      } finally {
        if (connection) {
          this.release(connection);
        }
      }
    }
  }

  async #executeWithConnection<Type = unknown>(
    connection: DatabaseSync,
    query: string,
    values?: unknown[]
  ): Promise<{ count: number; records: Type[] }> {
    console.debug('Executing SQLite JSON query', { query, values });

    // Handle dynamically built savepoint names that can't be parameterized
    if (query.includes('SAVEPOINT') || query.includes('ROLLBACK TO') || query.includes('RELEASE SAVEPOINT')) {
      if (values && values.length > 0) {
        query = query.replace('$1', `"${values[0]}"`);
        values = [];
      }
    }

    const normalizedQuery = query.trim().toUpperCase();
    const isSelect =
      normalizedQuery.startsWith('SELECT') || normalizedQuery.startsWith('PRAGMA') || normalizedQuery.includes(' RETURNING *');

    return this.#withRetries(async () => {
      try {
        const prepared = connection.prepare(query);
        prepared.setReadBigInts(true);
        const inputValues: SQLInputValue[] = castTo((values ?? []).map(x => (x instanceof Date ? x.toString() : x)));
        if (isSelect) {
          const output = prepared.all(...inputValues);
          const records: Type[] = castTo(output);
          return { count: output.length, records };
        } else {
          const output = prepared.run(...inputValues);
          return {
            count: typeof output.changes === 'number' ? output.changes : +output.changes.toString(),
            records: []
          };
        }
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? castTo<Record<string, unknown>>(error).code : undefined;
        const message = error instanceof Error ? error.message : undefined;
        switch (code) {
          case 'ERR_SQLITE_ERROR':
            if (message?.includes('UNIQUE constraint failed')) {
              throw new ExistsError('query', query);
            }
            if (message?.includes('already exists')) {
              if (message.includes('index')) {
                throw new ExistsError('index', query);
              }
              throw new ExistsError('query', query);
            }
            throw error;
          default:
            throw error;
        }
      }
    });
  }

  /**
   * Runs an operation within a database transaction context
   */
  async runWithTransaction<Result>(mode: TransactionType, operation: () => Promise<Result>): Promise<Result> {
    if (this.activeTransaction) {
      if (mode === 'isolated' || mode === 'force') {
        const transactionId = mode === 'isolated' ? `transaction_${Util.uuid()}` : undefined;
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
        let connection: DatabaseSync | undefined;
        try {
          connection = await this.acquire();
          this.#activeConnection.set(connection);
          this.#activeTransaction.set(true);

          if (this.isolatedTransactions && this.transactionDialect.isolate) {
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
  async startTransaction(connection: DatabaseSync, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(this.transactionDialect.beginNested, [transactionId]);
      }
    } else {
      if (this.isolatedTransactions && this.transactionDialect.isolate) {
        await this.execute(this.transactionDialect.isolate);
      }
      await this.execute(this.transactionDialect.begin);
    }
  }

  /**
   * Commits the active transaction or releases a savepoint
   */
  async commitTransaction(connection: DatabaseSync, transactionId?: string): Promise<void> {
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
  async rollbackTransaction(connection: DatabaseSync, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.isolatedTransactions) {
        await this.execute(this.transactionDialect.rollbackNested, [transactionId]);
      }
    } else {
      await this.execute(this.transactionDialect.rollback);
    }
  }
}
