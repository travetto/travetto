import * as mysql from 'mysql';

import { AsyncContext } from '@travetto/context';
import { ConnectionSupport } from '../../src/connection';
import { SQLModelConfig } from '../..';

const asAsync = <V = void, T = any>(ctx: T, prop: keyof T) => {
  return new Promise<V>((res, rej) => (ctx[prop] as any)(
    (err: any, val?: any) => err ? rej(err) : res(val)
  ));
};

/**
 * Connection support
 */
export class MySQLConnection implements ConnectionSupport<mysql.PoolConnection> {

  pool: mysql.Pool;

  constructor(
    private context: AsyncContext,
    private config: SQLModelConfig
  ) { }

  async init() {
    this.pool = mysql.createPool({
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port,
      ...(this.config.options || {})
    });
  }

  private get ctx() {
    return this.context.get<{ connection: any, topped?: boolean }>('connection');
  }

  get active(): mysql.PoolConnection {
    return this.ctx.connection;
  }

  /**
  * Acquire conn
  */
  async create() {
    const res = await asAsync<mysql.PoolConnection>(this.pool, 'getConnection');
    if (!this.active) {
      this.ctx.connection = res;
    }
    return res;
  }

  /**
   * Release conn
   */
  release(conn: mysql.PoolConnection) {
    if (conn) {
      if (this.active === conn) {
        this.context.clear('connection');
      }
      this.pool.releaseConnection(conn);
    }
  }

  // Transaction operations
  startTx = () => asAsync(this.active, 'beginTransaction');
  commit = () => asAsync(this.active, 'commit');
  rollback = () => asAsync(this.active, 'rollback');
}
