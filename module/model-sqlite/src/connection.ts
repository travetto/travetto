import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { createPool, type Pool } from 'generic-pool';

import type { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { ExistsError } from '@travetto/model';
import { SQLConnection } from '@travetto/model-sql';
import { castTo, Runtime, RuntimeError, ShutdownManager, Util } from '@travetto/runtime';

import type { SqliteModelConfig } from './config.ts';

const RECOVERABLE_MESSAGE = /database( table| schema)? is (locked|busy)/;
const isRecoverableError = (error: unknown): error is Error => error instanceof Error && RECOVERABLE_MESSAGE.test(error.message);

/**
 * SQLite Connection Manager.
 * Operates on node:sqlite DatabaseSync using a pool with max=1.
 */
@Injectable()
export class SqliteConnection extends SQLConnection<DatabaseSync> {
  isolatedTransactions = false;

  #pool: Pool<DatabaseSync>;
  readonly config: SqliteModelConfig;

  constructor(context: AsyncContext, config: SqliteModelConfig) {
    super(context);
    this.config = config;
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
    const file = path.resolve(this.config.options.file ?? Runtime.toolPath('@', 'sqlite_db'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file, this.config.options);
    for (const q of ['PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL', 'PRAGMA synchronous = NORMAL']) {
      await this.#withRetries(async () => db.exec(q));
    }
    // Register custom regex function for SQL regex support
    db.function('regexp', (a, b) => (new RegExp(`${a}`).test(`${b}`) ? 1 : 0));
    return db;
  }

  /**
   * Initializes the pool and sets connection pragma configuration
   */
  async init(): Promise<void> {
    this.transactionDialect = { ...this.transactionDialect, begin: 'BEGIN IMMEDIATE;' };

    await this.#create();

    this.#pool = createPool<DatabaseSync>(
      {
        create: () => this.#withRetries(() => this.#create()),
        destroy: async db => {
          db.close();
        }
      },
      { max: 1 }
    );

    ShutdownManager.signal.addEventListener('abort', () => this.#pool.clear());
  }

  /**
   * Acquires a DB connection
   */
  acquire(): Promise<DatabaseSync> {
    return this.#withRetries(() => this.#pool.acquire());
  }

  /**
   * Releases a DB connection back to pool
   */
  release(connection: DatabaseSync): void {
    this.#pool.release(connection);
  }

  /**
   * Executes a query on the active client or pool directly
   */
  async execute<Type = unknown>(query: string, values?: unknown[]): Promise<{ count: number; records: Type[] }> {
    const isSelect = query.trim().startsWith('SELECT') || query.trim().startsWith('PRAGMA') || query.trim().startsWith('EXISTS');

    return this.#withRetries(async () => {
      console.debug('Executing SQLite query', { query, values });
      const client = this.active ?? (await this.acquire());
      try {
        const prepared = client.prepare(query);
        prepared.setReadBigInts(true);
        if (isSelect) {
          const out = prepared.all(...castTo<SQLInputValue[]>(values ?? []));
          const records: Type[] = out.map(item => ({ ...castTo<Type>(item) }));
          return { count: out.length, records };
        } else {
          const out = prepared.run(...castTo<SQLInputValue[]>(values ?? []));
          return { count: typeof out.changes === 'number' ? out.changes : +out.changes.toString(), records: [] };
        }
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        const message = error instanceof Error ? error.message : undefined;
        switch (code) {
          case 'ERR_SQLITE_ERROR': {
            if (message?.startsWith('UNIQUE')) {
              throw new ExistsError('query', query);
            }
            break;
          }
          case 'SQLITE_CONSTRAINT_PRIMARYKEY':
          case 'SQLITE_CONSTRAINT_UNIQUE':
          case 'SQLITE_CONSTRAINT_INDEX':
            throw new ExistsError('query', query);
        }
        if (/index.*?already exists/.test(message ?? '')) {
          throw new ExistsError('index', query);
        }
        throw error;
      } finally {
        if (!this.active) {
          this.release(client);
        }
      }
    });
  }
}
