// @file-if mysql
import * as mysql from 'mysql';

import { AsyncContext } from '@travetto/context';
import { ConnectionSupport } from '../../connection';
import { SQLModelConfig } from '../../config';

const asAsync = <V = void, T = any>(ctx: T, prop: keyof T) => {
  // @ts-ignore
  const fn = ctx[prop].bind(ctx) as Function;
  return new Promise<V>((res, rej) => fn(
    (err: any, val?: any) => err ? rej(err) : res(val)
  ));
};

/**
 * Connection support for mysql
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
      typeCast: this.typeCast.bind(this),
      ...(this.config.options || {})
    });
  }

  /**
   * Support some basic type support for JSON data
   */
  typeCast(field: Parameters<Exclude<mysql.TypeCast, boolean>>[0], next: () => void) {
    const res: any = next();
    if (typeof res === 'string' && (field.type === 'JSON' || field.type === 'BLOB')) {
      if (res.charAt(0) === '{' && res.charAt(res.length - 1) === '}') {
        try {
          return (JSON.parse(res));
        } catch { }
      }
    }
    return res;
  }

  get asyncContext() {
    return this.context.get<{ connection: mysql.PoolConnection }>('connection');
  }

  get active(): mysql.PoolConnection {
    return this.asyncContext.connection;
  }

  /**
  * Acquire conn
  */
  async acquire() {
    const res = await asAsync<mysql.PoolConnection>(this.pool, 'getConnection');
    if (!this.active) {
      this.asyncContext.connection = res;
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

  startNestedTx = async (id: string) => { await this.active.query(`SAVEPOINT ${id}`); };
  commitNested = async (id: string) => { await this.active.query(`RELEASE SAVEPOINT ${id}`); };
  rollbackNested = async (id: string) => { await this.active.query(`ROLLBACK TO ${id}`); };
}