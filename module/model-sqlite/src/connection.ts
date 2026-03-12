import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, type DatabaseSyncOptions, type SQLInputValue, } from 'node:sqlite';

import { type Pool, createPool } from 'generic-pool';

import { ShutdownManager, Util, Runtime, RuntimeError, castTo } from '@travetto/runtime';
import { type AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { type SQLModelConfig, Connection } from '@travetto/model-sql';

const RECOVERABLE_MESSAGE = /database( table| schema)? is (locked|busy)/;

const isRecoverableError = (error: unknown): error is Error =>
  Error.isError(error) && RECOVERABLE_MESSAGE.test(error.message);

/**
 * Connection support for Sqlite
 */
export class SqliteConnection extends Connection<DatabaseSync> {

  isolatedTransactions = false;

  #config: SQLModelConfig<DatabaseSyncOptions & { file?: string }>;
  #pool: Pool<DatabaseSync>;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig<DatabaseSyncOptions & { file?: string }>
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
          await Util.blockingTimeout(delay);
        } else {
          throw error;
        }
      }
    }
    throw new RuntimeError('Max retries exceeded');
  }

  async #create(): Promise<DatabaseSync> {
    const file = path.resolve(this.#config.options.file ?? Runtime.toolPath('@', 'sqlite_db'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file, this.#config.options);
    for (const q of [
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
    ]) {
      await this.#withRetries(async () => db.exec(q));
    }
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

    this.#pool = createPool<DatabaseSync>({
      create: () => this.#withRetries(() => this.#create()),
      destroy: async db => { db.close(); }
    }, { max: 1 });

    // Close postgres
    ShutdownManager.signal.addEventListener('abort', () => this.#pool.clear());
  }

  async execute<T = unknown>(connection: DatabaseSync, query: string, values?: unknown[]): Promise<{ count: number, records: T[] }> {
    const isSelect = query.trim().startsWith('SELECT');
    return this.#withRetries(async () => {
      console.debug('Executing query', { query });

      try {
        const prepared = connection.prepare(query);
        prepared.setReadBigInts(true);
        if (isSelect) {
          const out = prepared.all(...castTo<SQLInputValue[]>(values ?? []));
          const records: T[] = out.map(item => ({ ...castTo<T>(item) }));
          return { count: out.length, records };
        } else {
          const out = prepared.run(...castTo<SQLInputValue[]>(values ?? []));
          return { count: typeof out.changes === 'number' ? out.changes : +out.changes.toString(), records: [] };
        }
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        const message = Error.isError(error) ? error.message : undefined;
        switch (code) {
          case 'ERR_SQLITE_ERROR': {
            if (message?.startsWith('UNIQUE')) {
              throw new ExistsError('query', query);
            }
            break;
          }
          case 'SQLITE_CONSTRAINT_PRIMARYKEY':
          case 'SQLITE_CONSTRAINT_UNIQUE':
          case 'SQLITE_CONSTRAINT_INDEX': throw new ExistsError('query', query);
        };
        if (/index.*?already exists/.test(message ?? '')) {
          throw new ExistsError('index', query);
        }
        throw error;
      }
    });
  }

  async acquire(): Promise<DatabaseSync> {
    return await this.#pool.acquire();
  }

  async release(db: DatabaseSync): Promise<void> {
    return this.#pool.release(db);
  }

  async pragma<T>(query: string): Promise<T> {
    const db = await this.acquire();
    try {
      const result = this.#withRetries(async () => db.prepare(`PRAGMA ${query}`).get());
      return castTo<T>(result);
    } finally {
      await this.release(db);
    }
  }
}