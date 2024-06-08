import fs from 'node:fs/promises';
import path from 'node:path';

import sqlDb, { type Database, Options } from 'better-sqlite3';
import { Pool, createPool } from 'generic-pool';

import { ShutdownManager, Util, Runtime } from '@travetto/runtime';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { SQLModelConfig, Connection } from '@travetto/model-sql';

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

  async #withRetries<T>(op: () => Promise<T>, retries = 10, delay = 250): Promise<T> {
    for (; ;) {
      try {
        return await op();
      } catch (err) {
        if (err instanceof Error && retries > 1 && err.message.includes('database is locked')) {
          console.error('Failed, and waiting', retries);
          await Util.blockingTimeout(delay);
          retries -= 1;
        } else {
          throw err;
        }
      }
    }
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
    ShutdownManager.onGracefulShutdown(() => this.#pool.clear(), this);
  }

  async execute<T = unknown>(conn: Database, query: string): Promise<{ count: number, records: T[] }> {
    return this.#withRetries(async () => {
      console.debug('Executing query', { query });
      try {
        const out = await conn.prepare<unknown[], T>(query)[query.trim().startsWith('SELECT') ? 'all' : 'run']();
        if (Array.isArray(out)) {
          const records: T[] = out.map(v => ({ ...v }));
          return { count: out.length, records };
        } else {
          return { count: out.changes, records: [] };
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          throw new ExistsError('query', query);
        } else {
          throw err;
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
}