import * as fs from 'fs/promises';

import type * as sqlite3 from 'better-sqlite3';
import Db = require('better-sqlite3');
import * as pool from 'generic-pool';

import { ShutdownManager, Util } from '@travetto/base';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { SQLModelConfig, Connection } from '@travetto/model-sql';
import { PathUtil } from '@travetto/boot';

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
          await Util.wait(delay);
          retries -= 1;
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Initializes connection and establishes crypto extension for use with hashing
   */
  @WithAsyncContext()
  override async init(): Promise<void> {
    this.#pool = pool.createPool({
      create: () => this.#withRetries(async () => {
        const handle = await fs.open(PathUtil.resolveUnix(this.#config.options.file ?? '.trv-sqlite_db'));
        const buffer = await handle.readFile();
        await handle.close();

        const db = new Db(buffer, this.#config.options);
        await db.pragma('foreign_keys = ON');
        await db.pragma('journal_mode = WAL');
        db.function('regexp', (a, b) => new RegExp(a).test(b) ? 1 : 0);
        return db;
      }),
      destroy: async db => { db.close(); }
    }, { max: 1 });

    // Close postgres
    ShutdownManager.onShutdown(this.constructor.Ⲑid, () => this.#pool.clear());
  }

  async execute<T = unknown>(conn: sqlite3.Database, query: string): Promise<{ count: number, records: T[] }> {
    return this.#withRetries(async () => {
      console.debug('Executing query', { query });
      try {
        const out = await conn.prepare(query)[query.trim().startsWith('SELECT') ? 'all' : 'run']();
        if (Array.isArray(out)) {
          const records: T[] = [...out].map(v => ({ ...v }));
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

  async acquire(): Promise<Db.Database> {
    return this.#pool.acquire();
  }

  async release(db: sqlite3.Database): Promise<void> {
    return this.#pool.release(db);
  }
}