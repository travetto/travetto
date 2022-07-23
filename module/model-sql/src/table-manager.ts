import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistry } from '@travetto/model';
import { Class } from '@travetto/base';
import { ChangeEvent } from '@travetto/registry';
import { SchemaChange } from '@travetto/schema';

import { Connected, Transactional } from './connection/decorator';
import { SQLDialect } from './dialect/base';
import { SQLUtil, VisitStack } from './internal/util';
import { Connection } from './connection/base';

/**
 * Manage creation/updating of all tables
 */
export class TableManager {

  #dialect: SQLDialect;

  constructor(
    public context: AsyncContext,
    dialect: SQLDialect
  ) {
    this.#dialect = dialect;
  }

  #exec<T = unknown>(sql: string): Promise<{ records: T[], count: number }> {
    return this.#dialect.executeSQL<T>(sql);
  }

  /**
   * Create all needed tables for a given class
   */
  @WithAsyncContext({})
  @Connected()
  @Transactional()
  async createTables(cls: Class): Promise<void> {
    for (const op of this.#dialect.getCreateAllTablesSQL(cls)) {
      await this.#exec(op);
    }
    const indices = ModelRegistry.get(cls).indices;
    if (indices) {
      for (const op of this.#dialect.getCreateAllIndicesSQL(cls, indices)) {
        try {
          await this.#exec(op);
        } catch (err) {
          if (!(err instanceof Error)) {
            throw err;
          }
          if (!/\bexists|duplicate\b/i.test(err.message)) {
            throw err;
          }
        }
      }
    }
  }

  /**
   * Drop all tables for a given class
   */
  @WithAsyncContext({})
  @Connected()
  @Transactional()
  async dropTables(cls: Class): Promise<void> {
    for (const op of this.#dialect.getDropAllTablesSQL(cls)) {
      await this.#exec(op);
    }
  }

  /**
   * Drop all tables for a given class
   */
  @WithAsyncContext({})
  @Connected()
  @Transactional()
  async truncateTables(cls: Class): Promise<void> {
    for (const op of this.#dialect.getTruncateAllTablesSQL(cls)) {
      await this.#exec(op);
    }
  }


  /**
   * Get a valid connection
   */
  get conn(): Connection {
    return this.#dialect.conn;
  }

  /**
   * When the schema changes, update SQL
   */
  @WithAsyncContext({})
  @Transactional()
  @Connected()
  async changeSchema(cls: Class, change: SchemaChange): Promise<void> {
    try {
      const rootStack = SQLUtil.classToStack(cls);

      const changes = change.subs.reduce<Record<ChangeEvent<unknown>['type'], VisitStack[][]>>((acc, v) => {
        const path = v.path.map(f => ({ ...f }));
        for (const ev of v.fields) {
          acc[ev.type].push([...rootStack, ...path, { ...(ev.type === 'removing' ? ev.prev : ev.curr)! }]);
        }
        return acc;
      }, { added: [], changed: [], removing: [] });

      await Promise.all(changes.added.map(v => this.#dialect.executeSQL(this.#dialect.getAddColumnSQL(v))));
      await Promise.all(changes.changed.map(v => this.#dialect.executeSQL(this.#dialect.getModifyColumnSQL(v))));
      await Promise.all(changes.removing.map(v => this.#dialect.executeSQL(this.#dialect.getDropColumnSQL(v))));
    } catch (err) {
      // Failed to change
      console.error('Unable to change field', { error: err });
    }
  }
}