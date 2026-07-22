import { type AsyncContext, AsyncContextValue } from '@travetto/context';
import { type AsyncMethodDescriptor, castTo, Util } from '@travetto/runtime';

import type { SQLDialect } from './dialect.ts';

export type TransactionType = 'required' | 'isolated' | 'force';

export interface ConnectionAware {
  connection: SQLConnection;
}

/**
 * Decorator to ensure a method runs inside a database transaction
 */
export function Transactional(mode: TransactionType = 'required') {
  return function <Target extends ConnectionAware>(target: Target, property: string, descriptor: AsyncMethodDescriptor<Target>): void {
    const originalMethod = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof originalMethod> {
      return this.connection.runWithTransaction(mode, () => originalMethod.call(this, ...args));
    };
  };
}

/**
 * Base abstract connection manager for SQL Model services.
 * Uses @travetto/context to track active client connections and transaction state.
 */
export abstract class SQLConnection<ConnectionClient = unknown> {
  isolatedTransactions = true;
  nestedTransactions = true;

  abstract readonly dialect: SQLDialect;

  readonly context: AsyncContext;

  #activeConnection = new AsyncContextValue<ConnectionClient>(this, { failIfUnbound: { read: false } });
  #activeTransaction = new AsyncContextValue<boolean>(this, { failIfUnbound: { read: false } });

  constructor(context: AsyncContext) {
    this.context = context;
  }

  abstract namespace: string;
  abstract database: string;

  get active(): ConnectionClient | undefined {
    return this.#activeConnection.get();
  }

  get activeTransaction(): boolean {
    return !!this.#activeTransaction.get();
  }

  /**
   * Initializes the connection
   */
  abstract init(): Promise<void> | void;

  /**
   * Acquires a client connection
   */
  abstract acquire(): Promise<ConnectionClient>;

  /**
   * Releases a client connection
   */
  abstract release(connection: ConnectionClient): void;

  /**
   * Executes a SQL query
   */
  abstract execute<Type = unknown>(query: string, values?: unknown[]): Promise<{ count: number; records: Type[] }>;

  /**
   * Runs an operation with an active connection (allocating one if not already active)
   */
  async runWithConnection<Result>(operation: () => Promise<Result>): Promise<Result> {
    if (this.active) {
      return await operation();
    }

    return this.context.run(async () => {
      let connection: ConnectionClient | undefined;
      try {
        connection = await this.acquire();
        this.#activeConnection.set(connection);
        return await operation();
      } finally {
        if (connection) {
          this.release(connection);
        }
      }
    });
  }

  /**
   * Iterates with an active connection
   */
  async *iterateWithConnection<Result>(operation: () => AsyncIterable<Result>): AsyncIterable<Result> {
    if (this.active) {
      yield* operation();
      return;
    }

    const self = castTo<SQLConnection<ConnectionClient>>(this);
    yield* this.context.iterate(async function* () {
      let connection: ConnectionClient | undefined;
      try {
        connection = await self.acquire();
        self.#activeConnection.set(connection);
        yield* operation();
      } finally {
        if (connection) {
          self.release(connection);
        }
      }
    });
  }

  /**
   * Runs an operation within a database transaction context
   */
  async runWithTransaction<Result>(mode: TransactionType, operation: () => Promise<Result>): Promise<Result> {
    if (this.activeTransaction) {
      if (mode === 'isolated' || mode === 'force') {
        const transactionId = mode === 'isolated' ? `tx${Util.uuid()}` : undefined;
        try {
          await this.startTransaction(transactionId);
          const result = await operation();
          await this.commitTransaction(transactionId);
          return result;
        } catch (error) {
          try {
            await this.rollbackTransaction(transactionId);
          } catch {}
          throw error;
        }
      } else {
        return await operation();
      }
    } else {
      return this.runWithConnection(async () => {
        this.#activeTransaction.set(true);
        if (this.isolatedTransactions) {
          await this.execute(this.dialect.transactionStatements.isolate);
        }
        await this.execute(this.dialect.transactionStatements.begin);
        try {
          const result = await operation();
          await this.execute(this.dialect.transactionStatements.commit);
          return result;
        } catch (error) {
          try {
            await this.execute(this.dialect.transactionStatements.rollback);
          } catch {}
          throw error;
        } finally {
          this.#activeTransaction.set(false);
        }
      });
    }
  }

  /**
   * Starts a transaction or savepoint
   */
  async startTransaction(transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(this.dialect.transactionStatements.beginNested, [transactionId]);
      }
    } else {
      if (this.isolatedTransactions) {
        await this.execute(this.dialect.transactionStatements.isolate);
      }
      await this.execute(this.dialect.transactionStatements.begin);
    }
  }

  /**
   * Commits the transaction or release savepoint
   */
  async commitTransaction(transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(this.dialect.transactionStatements.commitNested, [transactionId]);
      }
    } else {
      await this.execute(this.dialect.transactionStatements.commit);
    }
  }

  /**
   * Rolls back the transaction or savepoint
   */
  async rollbackTransaction(transactionId?: string): Promise<void> {
    if (transactionId) {
      if (this.nestedTransactions) {
        await this.execute(this.dialect.transactionStatements.rollbackNested, [transactionId]);
      }
    } else {
      await this.execute(this.dialect.transactionStatements.rollback);
    }
  }
}
