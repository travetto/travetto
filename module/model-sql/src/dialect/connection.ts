/**
 * Connection is a common enough pattern, that it can
 * be separated out to allow for differences in connection
 * vs querying.
 */
export interface ConnectionSupport<C = any> {
  active: C;

  init?(): Promise<void> | void;
  create(): Promise<C>;
  release(conn: C): void;

  startTx(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface ConnectionAware<C = any> {
  conn: ConnectionSupport<C>;
}

async function runCommands<V extends ConnectionAware, R>(
  this: V,
  transactional: boolean,
  fn: (this: V, ...args: any[]) => R,
  args: any[]
): Promise<R> {
  const ogConn = this.conn.active; // See if there is an existing conn
  const top = !ogConn;
  const conn = ogConn || await this.conn.create();

  try {
    if (top) {
      if (transactional) {
        await this.conn.startTx();
      }
    }
    try {
      const res = await fn.apply(this, args);
      if (top && transactional) {
        await this.conn.commit();
      }
      return res;
    } catch (e) {
      if (top && transactional) {
        await this.conn.rollback();
      }
      throw e;
    }
  } finally {
    if (top) {
      await this.conn.release(conn);
    }
  }
}

export function Connected<T extends ConnectionAware>(transactional = false) {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = async function (this: T, ...args: any[]) {
      return await runCommands.call(this, transactional, og as any, args);
    };
  };
}
