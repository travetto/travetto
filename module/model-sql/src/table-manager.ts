import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistry, ModelType } from '@travetto/model-core';
import { ChangeEvent, Class } from '@travetto/registry';
import { SchemaChangeEvent } from '@travetto/schema';

import { SQLModelConfig } from './config';
import { Connected, Transactional, withTransaction } from './connection';
import { SQLDialect } from './dialect';

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
    return this.dialect.handleFieldChange(ev);
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
          await withTransaction(this, 'isolated', this.exec, [op]);
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
    if (this.dialect.handleFieldChange(ev)) {
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
}