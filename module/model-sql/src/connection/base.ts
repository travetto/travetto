import { castTo, Util } from '@travetto/runtime';
import { AsyncContext, AsyncContextValue } from '@travetto/context';

export type TransactionType = 'required' | 'isolated' | 'force';

/**
 * Connection is a common enough pattern, that it can
 * be separated out to allow for differences in connection
 * vs querying.
 */
export abstract class Connection<C = unknown> {

  isolatedTransactions = true;
  nestedTransactions = true;

  transactionDialect = {
    begin: 'BEGIN;',
    beginNested: 'SAVEPOINT $1;',
    isolate: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
    rollback: 'ROLLBACK;',
    rollbackNested: 'ROLLBACK TO $1;',
    commit: 'COMMIT;',
    commitNested: 'RELEASE SAVEPOINT $1;'
  };

  readonly context: AsyncContext;

  #active = new AsyncContextValue<C>(this);
  #activeTx = new AsyncContextValue<boolean>(this);

  constructor(context: AsyncContext) {
    this.context = context;
  }

  /**
   * Get active connection
   */
  get active(): C | undefined {
    return this.#active.get();
  }

  /**
   * Get active tx state
   */
  get activeTx(): boolean {
    return !!this.#activeTx.get();
  }

  /**
   * Initialize connection source
   */
  init?(): Promise<void> | void;

  /**
   * Executes a query on the connection
   * @param rawConnection
   * @param query
   */
  abstract execute<T = unknown>(rawConnection: C, query: string, values?: unknown[]): Promise<{ records: T[], count: number }>;

  /**
   * Acquire new connection
   */
  abstract acquire(): Promise<C>;

  /**
   * Release provided connection
   */
  abstract release(rawConnection: C): void;

  /**
   * Run operation with active connection
   * @param context
   * @param operation
   * @param args
   */
  async runWithActive<R>(operation: () => Promise<R>): Promise<R> {
    if (this.active) {
      return operation();
    }

    return this.context.run(async () => {
      let conn;
      try {
        conn = await this.acquire();
        this.#active.set(conn);
        return await operation();
      } finally {
        if (conn) {
          this.release(conn);
        }
      }
    });
  }

  /**
   * Iterate with active connection
   * @param context
   * @param operation
   * @param args
   */
  async * iterateWithActive<R>(operation: () => AsyncIterable<R>): AsyncIterable<R> {
    if (this.active) {
      yield* operation();
    }

    const self = castTo<Connection>(this);
    yield* this.context.iterate(async function* () {
      try {
        self.#active.set(await self.acquire());
        yield* operation();
      } finally {
        if (self.active) {
          self.release(self.active);
        }
      }
    });
  }

  /**
   * Run a function within a valid sql transaction.  Relies on @travetto/context.
   */
  async runWithTransaction<R>(mode: TransactionType, operation: () => Promise<R>): Promise<R> {
    if (this.activeTx) {
      if (mode === 'isolated' || mode === 'force') {
        const txId = mode === 'isolated' ? `tx${Util.uuid()}` : undefined;
        try {
          await this.startTx(this.active!, txId);
          const result = await operation();
          await this.commitTx(this.active!, txId);
          return result;
        } catch (error) {
          try { await this.rollbackTx(this.active!, txId); } catch { }
          throw error;
        }
      } else {
        return await operation();
      }
    } else {
      return this.runWithActive(() => {
        this.#activeTx.set(true);
        return this.runWithTransaction('force', operation);
      });
    }
  }

  /**
   * Start a transaction
   */
  async startTx(conn: C, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(conn, this.transactionDialect.beginNested, [transactionId]);
      }
    } else {
      if (this.isolatedTransactions) {
        await this.execute(conn, this.transactionDialect.isolate);
      }
      await this.execute(conn, this.transactionDialect.begin);
    }
  }

  /**
   * Commit active transaction
   */
  async commitTx(conn: C, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(conn, this.transactionDialect.commitNested, [transactionId]);
      }
    } else {
      await this.execute(conn, this.transactionDialect.commit);
    }
  }

  /**
   * Rollback active transaction
   */
  async rollbackTx(conn: C, transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.isolatedTransactions) {
        await this.execute(conn, this.transactionDialect.rollbackNested, [transactionId]);
      }
    } else {
      await this.execute(conn, this.transactionDialect.rollback);
    }
  }
}