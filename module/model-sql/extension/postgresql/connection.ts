import * as pg from 'pg';

import { AsyncContext } from '@travetto/context';
import { SQLModelConfig, ConnectionSupport, withConnection, withTransaction } from '../..';

/**
 * Connection support
 */
export class PostgreSQLConnection implements ConnectionSupport<pg.PoolClient> {

  pool: pg.Pool;

  constructor(
    private context: AsyncContext,
    private config: SQLModelConfig
  ) { }

  async init() {
    this.pool = new pg.Pool({
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port,
      ...(this.config.options || {})
    });

    try {
      await this.context.run(() =>
        withConnection({ conn: this }, () =>
          withTransaction({ conn: this }, 'required', () =>
            this.active.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;'))));
    } catch (err) {
      // swallow
    }
  }

  public get asyncContext() {
    return this.context.get<{ connection: pg.PoolClient }>('connection');
  }

  get active(): pg.PoolClient {
    return this.asyncContext.connection;
  }

  /**
  * Acquire conn
  */
  async acquire() {
    const res = await this.pool.connect();
    if (!this.active) {
      this.asyncContext.connection = res;
    }
    return res;
  }

  /**
   * Release conn
   */
  release(conn: pg.PoolClient) {
    if (conn) {
      if (this.active === conn) {
        this.context.clear('connection');
      }
      conn.release();
    }
  }

  // Transaction operations
  startTx = async () => { await this.active.query('BEGIN'); };
  commit = async () => { await this.active.query('COMMIT'); };
  rollback = async () => { await this.active.query('ROLLBACK'); };

  startNestedTx = async (id: string) => { await this.active.query(`SAVEPOINT ${id}`); };
  commitNested = async (id: string) => { await this.active.query(`RELEASE SAVEPOINT ${id}`); };
  rollbackNested = async (id: string) => { await this.active.query(`ROLLBACK TO ${id}`); };
}