import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistry, ModelType } from '@travetto/model-core';
import { ChangeEvent, Class } from '@travetto/registry';
import { SchemaChangeEvent } from '@travetto/schema';

import { SQLModelConfig } from './config';
import { Connected, Transactional } from './connection/decorator';
import { SQLDialect } from './dialect/base';
import { SQLUtil, VisitStack } from './internal/util';

/**
 * Manage creation/updating of all tables
 */
export class TableManager {

  constructor(
    public context: AsyncContext,
    private config: SQLModelConfig,
    private dialect: SQLDialect
  ) { }


  private exec<T = any>(sql: string) {
    return this.dialect.executeSQL<T>(sql);
  }

  /**
   * When the schema changes, update column
   */
  @Connected()
  @Transactional()
  private async onFieldChange(ev: SchemaChangeEvent) {
    return this.handleFieldChange(ev);
  }

  /**
   * Create all needed tables for a given class
   */
  @Connected()
  @Transactional()
  private async createTables(cls: Class<any>): Promise<void> {
    for (const op of this.dialect.getCreateAllTablesSQL(cls)) {
      await this.exec(op);
    }
    const indices = ModelRegistry.get(cls).indices;
    if (indices) {
      for (const op of this.dialect.getCreateAllIndicesSQL(cls, indices)) {
        try {
          await this.dialect.conn.runWithTransaction('isolated', () => this.exec(op));
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
  @Connected()
  @Transactional()
  private async dropTables(cls: Class<any>): Promise<void> {
    for (const op of this.dialect.getDropAllTablesSQL(cls)) {
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
  async onSchemaChange(ev: SchemaChangeEvent) {
    if (this.handleFieldChange(ev)) {
      try {
        await this.onFieldChange(ev);
      } catch (e) {
        // Failed to change
        console.error('Unable to change field', e);
      }
    }
  }

  /**
   * On model change
   */
  @WithAsyncContext({})
  async onModelChange<T extends ModelType>(e: ChangeEvent<Class<T>>) {
    if (!this.config.autoCreate) {
      return;
    }

    const cls = e.curr ?? e.prev!;
    if (cls !== ModelRegistry.getBaseModel(cls)) {
      return;
    }

    switch (e.type) {
      case 'removing': await this.dropTables(cls); break;
      case 'added': await this.createTables(cls); break;
    }
  }

  /**
   * Listen to field change and update the schema as needed
   */
  async handleFieldChange(e: SchemaChangeEvent): Promise<void> {
    const rootStack = SQLUtil.classToStack(e.cls);

    const changes = e.change.subs.reduce((acc, v) => {
      const path = v.path.map(f => ({ ...f }));
      for (const ev of v.fields) {
        acc[ev.type].push([...rootStack, ...path, { ...(ev.type === 'removing' ? ev.prev : ev.curr)! }]);
      }
      return acc;
    }, { added: [], changed: [], removing: [] } as Record<ChangeEvent<any>['type'], VisitStack[][]>);

    await Promise.all(changes.added.map(v => this.dialect.executeSQL(this.dialect.getAddColumnSQL(v))));
    await Promise.all(changes.changed.map(v => this.dialect.executeSQL(this.dialect.getModifyColumnSQL(v))));
    await Promise.all(changes.removing.map(v => this.dialect.executeSQL(this.dialect.getDropColumnSQL(v))));
  }
}