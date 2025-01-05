import { castTo, Util } from '@travetto/runtime';
import { AsyncContext } from '@travetto/context';

const ContextActiveSymbol: unique symbol = Symbol.for('@travetto/model:sql-active');
const TxActiveSymbol: unique symbol = Symbol.for('@travetto/model:sql-transaction');

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

  constructor(public readonly context: AsyncContext) {

  }

  /**
   * Get active connection
   */
  get active(): C {
    return this.context.get<C>(ContextActiveSymbol);
  }

  /**
   * Get active tx state
   */
  get activeTx(): boolean {
    return !!this.context.get<boolean>(TxActiveSymbol);
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
   * @param op
   * @param args
   */
  async runWithActive<R>(op: () => Promise<R>): Promise<R> {
    if (this.active) {
      return op();
    }

    return this.context.run(async () => {
      try {
        this.context.set(ContextActiveSymbol, await this.acquire());
        return await op();
      } finally {
        if (this.active) {
          this.release(this.active);
        }
      }
    });
  }

  /**
   * Iterate with active connection
   * @param context
   * @param op
   * @param args
   */
  async * iterateWithActive<R>(op: () => AsyncIterable<R>): AsyncIterable<R> {
    if (this.active) {
      yield* op();
    }

    const self = castTo<Connection>(this);
    yield* this.context.iterate(async function* () {
      try {
        self.context.set(ContextActiveSymbol, await self.acquire());
        yield* op();
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
  async runWithTransaction<R>(mode: TransactionType, op: () => Promise<R>): Promise<R> {
    if (this.activeTx) {
      if (mode === 'isolated' || mode === 'force') {
        const txId = mode === 'isolated' ? `tx${Util.uuid()}` : undefined;
        try {
          await this.startTx(this.active, txId);
          const res = await op();
          await this.commitTx(this.active, txId);
          return res;
        } catch (err) {
          try { await this.rollbackTx(this.active, txId); } catch { }
          throw err;
        }
      } else {
        return await op();
      }
    } else {
      return this.runWithActive(() => {
        this.context.set(TxActiveSymbol, true);
        return this.runWithTransaction('force', op);
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