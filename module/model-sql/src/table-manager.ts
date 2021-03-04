import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistry } from '@travetto/model';
import { Class } from '@travetto/base';
import { ChangeEvent } from '@travetto/registry';
import { SchemaChange } from '@travetto/schema';

import { Connected, Transactional } from './connection/decorator';
import { SQLDialect } from './dialect/base';
import { SQLUtil, VisitStack } from './internal/util';

/**
 * Manage creation/updating of all tables
 */
export class TableManager {

  constructor(
    public context: AsyncContext,
    private dialect: SQLDialect
  ) { }

  private exec<T = unknown>(sql: string) {
    return this.dialect.executeSQL<T>(sql);
  }

  /**
   * Create all needed tables for a given class
   */
  @WithAsyncContext({})
  @Connected()
  @Transactional()
  async createTables(cls: Class): Promise<void> {
    for (const op of this.dialect.getCreateAllTablesSQL(cls)) {
      await this.exec(op);
    }
    const indices = ModelRegistry.get(cls).indices;
    if (indices) {
      for (const op of this.dialect.getCreateAllIndicesSQL(cls, indices)) {
        try {
          await this.exec(op);
        } catch (e) {
          if (!/\bexists|duplicate\b/i.test(e.message)) {
            throw e;
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
    for (const op of this.dialect.getDropAllTablesSQL(cls)) {
      await this.exec(op);
    }
  }

  /**
   * Drop all tables for a given class
   */
  @WithAsyncContext({})
  @Connected()
  @Transactional()
  async truncateTables(cls: Class): Promise<void> {
    for (const op of this.dialect.getTruncateAllTablesSQL(cls)) {
      await this.exec(op);
    }
  }


  /**
   * Get a valid connection
   */
  get conn() {
    return this.dialect.conn;
  }

  /**
   * When the schema changes, update SQL
   */
  @WithAsyncContext({})
  @Transactional()
  @Connected()
  async changeSchema(cls: Class, change: SchemaChange) {
    try {
      const rootStack = SQLUtil.classToStack(cls);

      const changes = change.subs.reduce((acc, v) => {
        const path = v.path.map(f => ({ ...f }));
        for (const ev of v.fields) {
          acc[ev.type].push([...rootStack, ...path, { ...(ev.type === 'removing' ? ev.prev : ev.curr)! }]);
        }
        return acc;
      }, { added: [], changed: [], removing: [] } as Record<ChangeEvent<unknown>['type'], VisitStack[][]>);

      await Promise.all(changes.added.map(v => this.dialect.executeSQL(this.dialect.getAddColumnSQL(v))));
      await Promise.all(changes.changed.map(v => this.dialect.executeSQL(this.dialect.getModifyColumnSQL(v))));
      await Promise.all(changes.removing.map(v => this.dialect.executeSQL(this.dialect.getDropColumnSQL(v))));
    } catch (e) {
      // Failed to change
      console.error('Unable to change field', { error: e });
    }
  }
}