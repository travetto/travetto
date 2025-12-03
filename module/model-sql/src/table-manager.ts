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
        } catch (error) {
          if (!(error instanceof Error)) {
            throw error;
          }
          if (!/\bexists|duplicate\b/i.test(error.message)) {
            throw error;
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
  get connection(): Connection {
    return this.#dialect.connection;
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

      const changes = change.subs.reduce<Record<ChangeEvent<unknown>['type'], VisitStack[][]>>((result, value) => {
        const path = value.path.map(field => ({ ...field }));
        for (const event of value.fields) {
          result[event.type].push([...rootStack, ...path, { ...(event.type === 'removing' ? event.previous : event.current)! }]);
        }
        return result;
      }, { added: [], changed: [], removing: [] });

      await Promise.all(changes.added.map(value => this.#dialect.executeSQL(this.#dialect.getAddColumnSQL(value))));
      await Promise.all(changes.changed.map(value => this.#dialect.executeSQL(this.#dialect.getModifyColumnSQL(value))));
      await Promise.all(changes.removing.map(value => this.#dialect.executeSQL(this.#dialect.getDropColumnSQL(value))));
    } catch (error) {
      // Failed to change
      console.error('Unable to change field', { error });
    }
  }
}