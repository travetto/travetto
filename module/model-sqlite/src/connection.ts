import fs from 'node:fs/promises';
import path from 'node:path';

import sqlDb, { type Database, Options } from 'better-sqlite3';
import { Pool, createPool } from 'generic-pool';

import { ShutdownManager, Util, Runtime, AppError, castTo } from '@travetto/runtime';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { SQLModelConfig, Connection } from '@travetto/model-sql';

const RECOVERABLE_MESSAGE = /database( table| schema)? is (locked|busy)/;

const isRecoverableError = (error: unknown): error is Error =>
  error instanceof Error && RECOVERABLE_MESSAGE.test(error.message);

/**
 * Connection support for Sqlite
 */
export class SqliteConnection extends Connection<Database> {

  isolatedTransactions = false;

  #config: SQLModelConfig<Options & { file?: string }>;
  #pool: Pool<Database>;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig<Options & { file?: string }>
  ) {
    super(context);
    this.#config = config;
  }

  async #withRetries<T>(operation: () => Promise<T>, retries = 10, delay = 250): Promise<T> {
    for (; retries > 1; retries -= 1) {
      try {
        return await operation();
      } catch (error) {
        if (isRecoverableError(error)) {
          console.error('Failed, and waiting', retries);
          await Util.blockingTimeout(delay);
        } else {
          throw error;
        }
      }
    }
    throw new AppError('Max retries exceeded');
  }

  async #create(): Promise<Database> {
    const file = path.resolve(this.#config.options.file ?? Runtime.toolPath('@', 'sqlite_db'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    const db = new sqlDb(file, this.#config.options);
    await db.pragma('foreign_keys = ON');
    await db.pragma('journal_mode = WAL');
    await db.pragma('synchronous = NORMAL');
    db.function('regexp', (a, b) => new RegExp(`${a}`).test(`${b}`) ? 1 : 0);
    return db;
  }

  /**
   * Initializes connection and establishes crypto extension for use with hashing
   */
  @WithAsyncContext()
  override async init(): Promise<void> {
    this.transactionDialect = { ...this.transactionDialect, begin: 'BEGIN IMMEDIATE;' };

    await this.#create();

    this.#pool = createPool<Database>({
      create: () => this.#withRetries(() => this.#create()),
      destroy: async db => { db.close(); }
    }, { max: 1 });

    // Close postgres
    ShutdownManager.onGracefulShutdown(() => this.#pool.clear());
  }

  async execute<T = unknown>(connection: Database, query: string, values?: unknown[]): Promise<{ count: number, records: T[] }> {
    return this.#withRetries(async () => {
      console.debug('Executing query', { query });
      try {
        const out = await connection.prepare<unknown[], T>(query)[query.trim().startsWith('SELECT') ? 'all' : 'run'](...values ?? []);
        if (Array.isArray(out)) {
          const records: T[] = out.map(item => ({ ...item }));
          return { count: out.length, records };
        } else {
          return { count: out.changes, records: [] };
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          throw new ExistsError('query', query);
        } else {
          throw error;
        }
      }
    });
  }

  async acquire(): Promise<sqlDb.Database> {
    return await this.#pool.acquire();
  }

  async release(db: Database): Promise<void> {
    return this.#pool.release(db);
  }

  async pragma<T>(query: string): Promise<T> {
    const db = await this.acquire();
    try {
      const result = db.pragma(query, { simple: false });
      return castTo<T>(result);
    } finally {
      await this.release(db);
    }
  }
}