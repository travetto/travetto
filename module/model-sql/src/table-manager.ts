import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistryIndex } from '@travetto/model';
import { Class } from '@travetto/runtime';
import { SchemaRegistryIndex, type SchemaFieldConfig } from '@travetto/schema';

import { Connected, Transactional } from './connection/decorator.ts';
import { SQLDialect } from './dialect/base.ts';
import { SQLModelUtil } from './util.ts';
import { Connection } from './connection/base.ts';
import { VisitStack } from './types.ts';

type UpsertStructure = { dropIndex: string[], createIndex: string[], dropTable: string[], createTable: string[], modifyTable: string[] };

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
  async getUpsertTablesSQL(cls: Class): Promise<UpsertStructure> {
    const sqlCommands: UpsertStructure = { dropIndex: [], createIndex: [], dropTable: [], createTable: [], modifyTable: [] };

    const onVisit = async (type: Class, fields: SchemaFieldConfig[], path: VisitStack[]): Promise<void> => {
      const found = await this.#dialect.describeTable(this.#dialect.table(path));
      const existingFields = new Map(found?.columns.map(column => [column.name, column]) ?? []);
      const existingIndices = new Map(found?.indices.map(index => [index.name, index]) ?? []);
      const requestedIndices = new Map(path.length === 1 ?
        (ModelRegistryIndex.getConfig(type).indices ?? []).map(index => [index.name, index]) :
        []
      );

      // Manage fields
      if (!existingFields.size) {
        sqlCommands.createTable.push(this.#dialect.getCreateTableSQL(path));
      } else { // Existing
        // Fields
        const requestedFields = new Map(fields.map(field => [field.name, field]));

        for (const [column, field] of requestedFields.entries()) {
          if (!existingFields.has(column)) {
            sqlCommands.modifyTable.push(this.#dialect.getAddColumnSQL([...path, field]));
          } else if (SQLModelUtil.isColumnChanged(
            field,
            existingFields.get(column)!,
            this.#dialect.getColumnType(field)
          )) {
            sqlCommands.modifyTable.push(this.#dialect.getModifyColumnSQL([...path, field]));
          }
        }

        for (const column of existingFields.keys()) {
          if (!requestedFields.has(column)) {
            sqlCommands.modifyTable.push(this.#dialect.getDropColumnSQL([...path, { name: column, type: undefined!, array: false }]));
          }
        }
      }

      // Manage indices
      for (const index of requestedIndices.keys()) {
        if (!existingIndices.has(index)) {
          sqlCommands.createIndex.push(this.#dialect.getCreateIndexSQL(type, requestedIndices.get(index)!));
        } else if (SQLModelUtil.isIndexChanged(requestedIndices.get(index)!, existingIndices.get(index)!)) {
          sqlCommands.dropIndex.push(...this.#dialect.getDropIndexSQL(type, existingIndices.get(index)!.columns));
          sqlCommands.createIndex.push(this.#dialect.getCreateIndexSQL(type, requestedIndices.get(index)!));
        }
      }

      for (const index of existingIndices.keys()) {
        if (!requestedIndices.has(index)) {
          sqlCommands.dropIndex.push(this.#dialect.getDropIndexSQL(type, existingIndices.get(index)!.columns));
        }
      }
    };

    const schema = SchemaRegistryIndex.getConfig(cls);
    await SQLModelUtil.visitSchema(schema, {
      onRoot: async ({ config, path, fields, descend }) => { await onVisit(config.class, fields, path); return descend(); },
      onSub: async ({ config, path, fields, descend }) => { await onVisit(config.type, fields, path); return descend(); },
      onSimple: async ({ config, path, fields }) => { await onVisit(config.type, fields, path); }
    });
    return sqlCommands;
  }

  @WithAsyncContext()
  @Connected()
  @Transactional()
  async upsertTables(cls: Class): Promise<void> {
    const sqlCommands = await this.getUpsertTablesSQL(cls);
    for (const key of ['dropIndex', 'dropTable', 'createTable', 'modifyTable', 'createIndex'] as const) {
      await Promise.all(sqlCommands[key].map(command => this.#exec(command)));
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