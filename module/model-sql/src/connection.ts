import { Util } from '@travetto/base';

/**
 * Connection is a common enough pattern, that it can
 * be separated out to allow for differences in connection
 * vs querying.
 */
export interface ConnectionSupport<C = any> {
  active: C;
  asyncContext: { connection: C, pendingTx?: number };

  /**
   * Initialize connection source
   */
  init?(): Promise<void> | void;
  /**
   * Acquire new connection
   */
  acquire(): Promise<C>;
  /**
   * Release provided connection
   */
  release(conn: C): void;

  /**
   * Start a transaction
   */
  startTx(): Promise<void>;
  /**
   * Commit active transaction
   */
  commit(): Promise<void>;
  /**
   * Rollback active transaction
   */
  rollback(): Promise<void>;

  /**
   * Start a nested transaction by id, not supported in all dbs
   */
  startNestedTx(id: string): Promise<void>;
  /**
   * Commit a nested transaction by id, not supported in all dbs
   */
  commitNested(id: string): Promise<void>;
  /**
   * Rollback a nested transaction by id, not supported in all dbs
   */
  rollbackNested(id: string): Promise<void>;
}

export type TransactionType = 'required' | 'isolated';

/**
 * Indicating something is aware of connections
 */
export interface ConnectionAware<C = any> {
  conn: ConnectionSupport<C>;
}

/**
 * Run a function with a valid sql connection available.  Relies on @travetto/context.
 */
export async function withConnection<V extends ConnectionAware, R>(
  self: V,
  fn: (this: V, ...argv: any[]) => R,
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


/**
 * Run a function with a valid sql connection available.  Relies on @travetto/context.
 */
export async function* withConnectionIterator<V extends ConnectionAware, R>(
  self: V,
  fn: (this: V, ...argv: any[]) => AsyncGenerator<R>,
  args: any[] = []
): AsyncGenerator<R> {
  const ogConn = self.conn.active; // See if there is an existing conn
  const top = !ogConn;
  if (top) {
    let conn;
    try {
      conn = await self.conn.acquire();
      yield* fn.apply(self, args);
    } finally {
      await self.conn.release(conn);
    }
  } else {
    yield* fn.apply(self, args);
  }
}
/**
 * Run a function within a valid sql transaction.  Relies on @travetto/context.
 */
export async function withTransaction<V extends ConnectionAware, R>(
  self: V,
  mode: TransactionType,
  fn: (this: V, ...argv: any[]) => R,
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

/**
 * Decorator to ensure a method runs with a valid connection
 */
export function Connected<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return withConnection(this, og, args);
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid connection
 */
export function ConnectedIterator<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => AsyncGenerator<any>>) {
    const og = desc.value!;
    desc.value = async function* (this: T, ...args: any[]) {
      yield* withConnectionIterator(this, og, args);
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid transaction
 */
export function Transactional<T extends ConnectionAware>(mode: TransactionType = 'required') {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return withTransaction(this, mode, og, args);
    };
  };
}
