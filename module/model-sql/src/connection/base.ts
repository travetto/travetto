import { Util } from '@travetto/base';
import { AsyncContext } from '@travetto/context';

const ContextActiveSym = Symbol.for('@trv:model/sql-active');
const TxActiveSym = Symbol.for('@trv:model/sql-transaction');

export type TransactionType = 'required' | 'isolated' | 'force';

/**
 * Connection is a common enough pattern, that it can
 * be separated out to allow for differences in connection
 * vs querying.
 */
export abstract class Connection<C = any> {

  constructor(public readonly context: AsyncContext) {

  }

  /**
   * Get active connection
   */
  get active(): C {
    return this.context.get()[ContextActiveSym] as C;
  }

  /**
   * Get active tx state
   */
  get activeTx() {
    return !!this.context.get()[TxActiveSym] as boolean;
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
  abstract execute<T = any>(rawConnection: C, query: string): Promise<{ records: T[], count: number }>;

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
  async runWithActive<R>(op: () => Promise<R>) {
    if (this.active) {
      return op();
    }

    return await this.context.run(async () => {
      try {
        this.context.set(ContextActiveSym, await this.acquire());
        return op();
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
  async * iterateWithActive<R>(op: () => AsyncGenerator<R>) {
    if (this.active) {
      yield* op();
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    yield* this.context.iterate(async function* () {
      try {
        self.context.set(ContextActiveSym, await self.acquire());
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
  async runWithTransaction<R>(mode: TransactionType, op: () => R): Promise<R> {
    if (this.activeTx) {
      if (mode === 'isolated' || mode === 'force') {
        const txId = mode === 'isolated' ? `tx${Util.uuid()}` : undefined;
        try {
          await this.startTx(this.active, txId);
          const res = await op();
          await this.commitTx(this.active, txId);
          return res;
        } catch (err) {
          await this.rollbackTx(this.active, txId);
          throw err;
        }
      } else {
        return await op();
      }
    } else {
      return this.runWithActive(() => {
        this.context.set(TxActiveSym, true);
        return this.runWithTransaction('force', op);
      });
    }
  }

  /**
   * Start a transaction
   */
  async startTx(conn: C, transactionId?: string) {
    if (transactionId) {
      return this.execute(conn, `SAVEPOINT ${transactionId}`);
    } else {
      await this.execute(conn, 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;');
      await this.execute(conn, 'BEGIN');
    }
  }

  /**
   * Commit active transaction
   */
  commitTx(conn: C, transactionId?: string) {
    if (transactionId) {
      return this.execute(conn, `RELEASE SAVEPOINT ${transactionId}`);
    } else {
      return this.execute(conn, 'COMMIT');
    }
  }

  /**
   * Rollback active transaction
   */
  rollbackTx(conn: C, transactionId?: string) {
    if (transactionId) {
      return this.execute(conn, `ROLLBACK TO ${transactionId}`);
    } else {
      return this.execute(conn, 'ROLLBACK');
    }
  }
}