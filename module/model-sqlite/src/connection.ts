import fs from 'fs/promises';
import timers from 'timers/promises';
import sqlDb, * as sqlite3 from 'better-sqlite3';
import pool from 'generic-pool';

import { ManifestFileUtil, RootIndex, path } from '@travetto/manifest';
import { ShutdownManager } from '@travetto/base';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { SQLModelConfig, Connection } from '@travetto/model-sql';

/**
 * Connection support for Sqlite
 */
export class SqliteConnection extends Connection<sqlite3.Database> {

  isolatedTransactions = false;

  #config: SQLModelConfig<sqlite3.Options & { file?: string }>;
  #pool: pool.Pool<sqlite3.Database>;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig<sqlite3.Options & { file?: string }>
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
          await timers.setTimeout(delay);
          retries -= 1;
        } else {
          throw err;
        }
      }
    }
  }

  async #create(): Promise<sqlite3.Database> {
    const file = path.resolve(this.#config.options.file ??
      ManifestFileUtil.toolPath(RootIndex, 'sqlite_db', true));
    await fs.mkdir(path.dirname(file), { recursive: true });
    const db = new sqlDb(file, this.#config.options);
    await db.pragma('foreign_keys = ON');
    await db.pragma('journal_mode = WAL');
    db.function('regexp', (a, b) => new RegExp(`${a}`).test(`${b}`) ? 1 : 0);
    return db;
  }

  /**
   * Initializes connection and establishes crypto extension for use with hashing
   */
  @WithAsyncContext()
  override async init(): Promise<void> {
    await this.#create();

    this.#pool = pool.createPool<sqlite3.Database>({
      create: () => this.#withRetries(() => this.#create()),
      destroy: async db => { db.close(); }
    }, { max: 1 });

    // Close postgres
    ShutdownManager.onGracefulShutdown(() => this.#pool.clear(), this);
  }

  async execute<T = unknown>(conn: sqlite3.Database, query: string): Promise<{ count: number, records: T[] }> {
    return this.#withRetries(async () => {
      console.debug('Executing query', { query });
      try {
        const out = await conn.prepare(query)[query.trim().startsWith('SELECT') ? 'all' : 'run']();
        if (Array.isArray(out)) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const records: T[] = [...out as T[]].map(v => ({ ...v }));
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

  async release(db: sqlite3.Database): Promise<void> {
    return this.#pool.release(db);
  }
}