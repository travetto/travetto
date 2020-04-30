import { Util } from '@travetto/base';

/**
 * Connection is a common enough pattern, that it can
 * be separated out to allow for differences in connection
 * vs querying.
 */
// TODO: Document
export interface ConnectionSupport<C = any> {
  active: C;
  asyncContext: { connection: C, pendingTx?: number };

  init?(): Promise<void> | void;
  acquire(): Promise<C>;
  release(conn: C): void;

  startTx(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;

  startNestedTx(id: string): Promise<void>;
  commitNested(id: string): Promise<void>;
  rollbackNested(id: string): Promise<void>;
}

export type TransactionType = 'required' | 'isolated';

// TODO: Document
export interface ConnectionAware<C = any> {
  conn: ConnectionSupport<C>;
}

// TODO: Document
export async function withConnection<V extends ConnectionAware, R>(
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

// TODO: Document
export async function withTransaction<V extends ConnectionAware, R>(
  self: V,
  mode: TransactionType,
  fn: (this: V, ...args: any[]) => R,
  args: any[] = []
): Promise<R> {
  const ctx = self.conn.asyncContext;
  if (!ctx.pendingTx) {
    try {
      ctx.pendingTx = 1;
      await self.conn.startTx();
      const res = await fn.apply(self, args);
      await self.conn.commit();
      return res;
    } catch (e) {
      await self.conn.rollback();
      throw e;
    } finally {
      ctx.pendingTx = 0;
    }
  } else if (mode === 'isolated') {
    const id = `tx${Util.uuid()}`;
    try {
      ctx.pendingTx = ctx.pendingTx + 1;
      await self.conn.startNestedTx(id);
      const res = await fn.apply(self, args);
      await self.conn.commitNested(id);
      return res;
    } catch (e) {
      await self.conn.rollbackNested(id);
      throw e;
    } finally {
      ctx.pendingTx = ctx.pendingTx - 1;
    }
  } else {
    return fn.apply(self, args);
  }
}

// TODO: Document
export function Connected<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return withConnection(this, og as any, args);
    };
  };
}

// TODO: Document
export function Transactional<T extends ConnectionAware>(mode: TransactionType = 'required') {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return withTransaction(this, mode, og as any, args);
    };
  };
}
