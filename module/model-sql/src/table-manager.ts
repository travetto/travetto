import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistryIndex } from '@travetto/model';
import { Class } from '@travetto/runtime';
import { ChangeEvent } from '@travetto/registry';
import { SchemaChange } from '@travetto/schema';

import { Connected, Transactional } from './connection/decorator.ts';
import { SQLDialect } from './dialect/base.ts';
import { SQLModelUtil } from './util.ts';
import { Connection } from './connection/base.ts';
import { VisitStack } from './types.ts';

/**
 * Manage creation/updating of all tables
 */
export class TableManager {

  #dialect: SQLDialect;
  context: AsyncContext;

  constructor(context: AsyncContext, dialect: SQLDialect) {
    this.#dialect = dialect;
    this.context = context;
  }

  #exec<T = unknown>(sql: string): Promise<{ records: T[], count: number }> {
    return this.#dialect.executeSQL<T>(sql);
  }

  /**
   * Create all needed tables for a given class
   */
  async exportTables(cls: Class): Promise<string[]> {
    const out: string[] = [];
    for (const command of this.#dialect.getCreateAllTablesSQL(cls)) {
      out.push(command);
    }
    const indices = ModelRegistryIndex.getConfig(cls).indices;
    if (indices) {
      for (const command of this.#dialect.getCreateAllIndicesSQL(cls, indices)) {
        out.push(command);
      }
    }
    return out;
  }

  /**
   * Create all needed tables for a given class
   */
  @WithAsyncContext()
  @Connected()
  @Transactional()
  async createTables(cls: Class): Promise<void> {
    for (const command of this.#dialect.getCreateAllTablesSQL(cls)) {
      await this.#exec(command);
    }
    const indices = ModelRegistryIndex.getConfig(cls).indices;
    if (indices) {
      for (const command of this.#dialect.getCreateAllIndicesSQL(cls, indices)) {
        try {
          await this.#exec(command);
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
  @WithAsyncContext()
  @Connected()
  @Transactional()
  async dropTables(cls: Class): Promise<void> {
    for (const command of this.#dialect.getDropAllTablesSQL(cls)) {
      await this.#exec(command);
    }
  }

  /**
   * Drop all tables for a given class
   */
  @WithAsyncContext()
  @Connected()
  @Transactional()
  async truncateTables(cls: Class): Promise<void> {
    for (const command of this.#dialect.getTruncateAllTablesSQL(cls)) {
      await this.#exec(command);
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
  @WithAsyncContext()
  @Transactional()
  @Connected()
  async changeSchema(cls: Class, change: SchemaChange): Promise<void> {
    try {
      const rootStack = SQLModelUtil.classToStack(cls);

      const changes = change.subs.reduce<Record<ChangeEvent<unknown>['type'], VisitStack[][]>>((acc, v) => {
        const path = v.path.map(f => ({ ...f }));
        for (const event of v.fields) {
          acc[event.type].push([...rootStack, ...path, { ...(event.type === 'removing' ? event.prev : event.curr)! }]);
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