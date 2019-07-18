import * as pg from 'pg';

import { AsyncContext } from '@travetto/context';
import { SQLModelConfig, ConnectionSupport } from '../..';

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

    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    } catch (err) {
      // swallow
    }
    await client.release();
  }

  private get ctx() {
    return this.context.get<{ connection: any, topped?: boolean }>('connection');
  }

  get active(): pg.PoolClient {
    return this.ctx.connection;
  }

  /**
  * Acquire conn
  */
  async create() {
    const res = await this.pool.connect();
    if (!this.active) {
      this.ctx.connection = res;
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
}