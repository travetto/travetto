/**
 * Connection is a common enough pattern, that it can
 * be separated out to allow for differences in connection
 * vs querying.
 */
export interface ConnectionSupport<C = any> {
  active: C;
  asyncContext: { connection: C, pendingTx?: number };

  init?(): Promise<void> | void;
  acquire(): Promise<C>;
  release(conn: C): void;

  startTx(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export type TransactionType = 'required' | 'isolated';

export interface ConnectionAware<C = any> {
  conn: ConnectionSupport<C>;
}

export async function WithConnection<V extends ConnectionAware, R>(
  self: V,
  fn: (this: V, ...args: any[]) => R,
  args: any[] = []
): Promise<R> {
  const ogConn = self.conn.active; // See if there is an existing conn
  const top = !ogConn;
  if (top) {
    let conn;
    try {
      conn = await self.conn.acquire();
      return await fn.apply(self, args);
    } finally {
      await self.conn.release(conn);
    }
  } else {
    return await fn.apply(self, args);
  }
}

export async function WithTransaction<V extends ConnectionAware, R>(
  self: V,
  mode: TransactionType,
  fn: (this: V, ...args: any[]) => R,
  args: any[] = []
): Promise<R> {
  let ctx = self.conn.asyncContext;
  const newTx = mode === 'isolated' || !ctx.pendingTx;
  if (newTx) {
    try {
      ctx.pendingTx = (ctx.pendingTx || 0) + 1;
      await self.conn.startTx();
      const res = await fn.apply(self, args);
      await self.conn.commit();
      return res;
    } catch (e) {
      await self.conn.rollback();
      throw e;
    } finally {
      ctx.pendingTx = (ctx.pendingTx || 1) - 1;
    }
  } else {
    return fn.apply(self, args);
  }
}

export function Connected<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return WithConnection(this, og as any, args);
    };
  };
}

export function Transactional<T extends ConnectionAware>(mode: TransactionType = 'required') {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return WithTransaction(this, mode, og as any, args);
    };
  };
}
