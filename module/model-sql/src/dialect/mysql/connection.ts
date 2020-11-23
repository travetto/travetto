// @file-if mysql
import * as mysql from 'mysql';

import { ShutdownManager } from '@travetto/base';
import { AsyncContext } from '@travetto/context';
import { ConnectionSupport } from '../../connection';
import { SQLModelConfig } from '../../config';

const isFn = (o: any): o is Function => o && 'bind' in o;

const asAsync = <V = void, T = any>(ctx: T, prop: keyof T) => {
  const val = ctx[prop];
  if (isFn(val)) {
    const fn = val.bind(ctx) as (cb: (err: any, val?: any) => void) => void;
    return new Promise<V>((res, rej) => fn((e, v) => e ? rej(e) : res(v)));
  } else {
    throw new Error(`Invalid async function: ${prop}`);
  }
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

    // Close mysql
    ShutdownManager.onShutdown(__filename, () => new Promise(r => this.pool.end(r)));
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