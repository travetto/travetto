// @file-if better-sqlite3
import * as sqlite3 from 'better-sqlite3';
import Db = require('better-sqlite3');
import * as pool from 'generic-pool';

import { ShutdownManager, Util } from '@travetto/base';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ExistsError } from '@travetto/model';
import { AppCache } from '@travetto/boot';

import { Connection } from '../../connection/base';
import { SQLModelConfig } from '../../config';

/**
 * Connection support for Sqlite
 */
export class SqliteConnection extends Connection<sqlite3.Database> {

  isolatedTransactions = false;

  #config: SQLModelConfig;
  #pool: pool.Pool<sqlite3.Database>;

  constructor(
    context: AsyncContext,
    config: SQLModelConfig
  ) {
    super(context);
    this.#config = config;
  }

  async #withRetries<T>(op: () => Promise<T>, retries = 10, delay = 250) {
    for (; ;) {
      try {
        return await op();
      } catch (err) {
        if (retries > 1 && err.message.includes('database is locked')) {
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
  override async init() {
    this.#pool = pool.createPool({
      create: () => this.#withRetries(async () => {
        const db = Db(AppCache.toEntryName('sqlite_db'),
          this.#config.options as sqlite3.Options
        );
        await db.pragma('foreign_keys = ON');
        await db.pragma('journal_mode = WAL');
        db.function('regexp', (a, b) => new RegExp(a).test(b) ? 1 : 0);
        return db;
      }),
      destroy: async db => { db.close(); }
    }, { max: 1 });

    // Close postgres
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.#pool.clear());
  }

  async execute<T = unknown>(conn: sqlite3.Database, query: string): Promise<{ count: number, records: T[] }> {
    return this.#withRetries(async () => {
      console.debug('Executing query', { query });
      try {
        const out = await conn.prepare(query)[query.trim().startsWith('SELECT') ? 'all' : 'run']();
        if (Array.isArray(out)) {
          return { count: out.length, records: [...out].map(v => ({ ...v })) as T[] };
        } else {
          return { count: out.changes, records: [] };
        }
      } catch (err) {
        throw err.message.includes('UNIQUE constraint failed') ? new ExistsError('query', query) : err;
      }
    });
  }

  async acquire() {
    return this.#pool.acquire();
  }

  async release(db: sqlite3.Database) {
    return this.#pool.release(db);
  }
}