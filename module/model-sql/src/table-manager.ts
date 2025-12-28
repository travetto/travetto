import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistryIndex } from '@travetto/model';
import { Class } from '@travetto/runtime';
import { SchemaRegistryIndex, type SchemaClassConfig } from '@travetto/schema';

import { Connected, Transactional } from './connection/decorator.ts';
import { SQLDialect, type SQLTableDescription } from './dialect/base.ts';
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
   * Get a valid connection
   */
  get connection(): Connection {
    return this.#dialect.connection;
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

  @WithAsyncContext()
  @Connected()
  @Transactional()
  async upsertTables(cls: Class): Promise<void> {

    const sqlCommands: string[] = [];

    const describeTable = (stack: VisitStack[]): Promise<SQLTableDescription | undefined> => this.#dialect.describeTable(this.#dialect.table(stack));

    const onVisit = async (config: SchemaClassConfig, path: VisitStack[]): Promise<void> => {
      const found = await describeTable(path);
      if (!found) {
        sqlCommands.push(this.#dialect.getCreateTableSQL(path));
      } else { // Existing
        // Fields
        const existingFields = new Map(found.columns.map(column => [column.name, column]));
        const existingIndices = new Map(found.indices.map(index => [index.name, index]));

        const requestedFields = new Map(Object.entries(config.fields));
        const requestedIndices = new Map((ModelRegistryIndex.getConfig(config.class).indices ?? []).map(index => [index.name, index]));

        for (const [column, field] of requestedFields.entries()) {
          if (!existingFields.has(column)) {
            sqlCommands.push(this.#dialect.getAddColumnSQL([...path, field]));
          } else if (SQLModelUtil.isColumnChanged(
            field,
            existingFields.get(column)!,
            this.#dialect.getColumnType(field)
          )) {
            sqlCommands.push(this.#dialect.getModifyColumnSQL([...path, field]));
          }
        }

        for (const index of requestedIndices.keys()) {
          if (!existingIndices.has(index)) {
            sqlCommands.push(this.#dialect.getCreateIndexSQL(config.class, requestedIndices.get(index)!));
          } else if (SQLModelUtil.isIndexChanged(requestedIndices.get(index)!, existingIndices.get(index)!)) {
            sqlCommands.push(
              this.#dialect.getDropIndexSQL(config.class, existingIndices.get(index)!.columns),
              this.#dialect.getCreateIndexSQL(config.class, requestedIndices.get(index)!)
            );
          }
        }

        for (const column of existingFields.keys()) {
          if (!requestedFields.has(column)) {
            sqlCommands.push(this.#dialect.getDropColumnSQL([...path, { name: column, type: undefined!, array: false }]));
          }
        }

        for (const index of existingIndices.keys()) {
          if (!requestedIndices.has(index)) {
            sqlCommands.push(...this.#dialect.getDropIndexSQL(config.class, existingIndices.get(index)!.columns));
          }
        }
      }
    };

    const schema = SchemaRegistryIndex.getConfig(cls);
    await SQLModelUtil.visitSchema(schema, {
      onRoot: ({ config, path }) => onVisit(config, path),
      onSub: ({ config, path }) => onVisit(SchemaRegistryIndex.getConfig(config.type), path),
      async onSimple() { },
    });
    await this.#exec(sqlCommands.join(';\n'));
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
}