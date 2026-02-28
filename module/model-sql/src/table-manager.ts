import { type AsyncContext, WithAsyncContext } from '@travetto/context';
import { ModelRegistryIndex } from '@travetto/model';
import { type Class } from '@travetto/runtime';
import { SchemaRegistryIndex, type SchemaFieldConfig } from '@travetto/schema';

import { Connected, Transactional } from './connection/decorator.ts';
import type { SQLDialect } from './dialect/base.ts';
import { SQLModelUtil } from './util.ts';
import type { Connection } from './connection/base.ts';
import type { VisitStack } from './types.ts';

type UpsertStructure = { dropIndex: string[], createIndex: string[], table: string[] };
const isSimpleField = (input: VisitStack | undefined): input is SchemaFieldConfig =>
  !!input && (!('type' in input) || (input.type && !SchemaRegistryIndex.has(input.type)));

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
    const sqlCommands: UpsertStructure = { dropIndex: [], createIndex: [], table: [] };

    const onVisit = async (type: Class, fields: SchemaFieldConfig[], path: VisitStack[]): Promise<void> => {
      const found = await this.#dialect.describeTable(this.#dialect.namespace(path));
      const existingFields = new Map(found?.columns.map(column => [column.name, column]) ?? []);
      const existingIndices = new Map(found?.indices.map(index => [index.name, index]) ?? []);
      const model = path.length === 1 ? ModelRegistryIndex.getConfig(type) : undefined;
      const requestedIndices = new Map((model?.indices ?? []).map(index => [this.#dialect.getIndexName(type, index), index]) ?? []);

      // Manage fields
      if (!existingFields.size) {
        sqlCommands.table.push(this.#dialect.getCreateTableSQL(path));
      } else { // Existing
        // Fields
        const requestedFields = new Map(fields.map(field => [field.name, field]));
        const top = path.at(-1);

        if (isSimpleField(top)) {
          requestedFields.set(top.name, top);
        }

        for (const [column, field] of requestedFields.entries()) {
          if (!existingFields.has(column)) {
            sqlCommands.table.push(this.#dialect.getAddColumnSQL([...path, field]));
          } else if (this.#dialect.isColumnChanged(field, existingFields.get(column)!)) {
            sqlCommands.table.push(this.#dialect.getModifyColumnSQL([...path, field]));
          }
        }

        // TODO: Handle dropping tables that are FK'd when no longer in use

        for (const column of existingFields.keys()) {
          if (!requestedFields.has(column)) {
            sqlCommands.table.push(this.#dialect.getDropColumnSQL([...path, { name: column, type: undefined!, array: false }]));
          }
        }
      }

      // Manage indices
      for (const index of requestedIndices.keys()) {
        if (!existingIndices.has(index)) {
          sqlCommands.createIndex.push(this.#dialect.getCreateIndexSQL(type, requestedIndices.get(index)!));
        } else if (this.#dialect.isIndexChanged(requestedIndices.get(index)!, existingIndices.get(index)!)) {
          sqlCommands.dropIndex.push(this.#dialect.getDropIndexSQL(type, existingIndices.get(index)!.name));
          sqlCommands.createIndex.push(this.#dialect.getCreateIndexSQL(type, requestedIndices.get(index)!));
        }
      }

      for (const index of existingIndices.keys()) {
        if (!requestedIndices.has(index)) {
          sqlCommands.dropIndex.push(this.#dialect.getDropIndexSQL(type, existingIndices.get(index)!.name));
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
    // Enforce id length
    this.#dialect.enforceIdLength(cls);

    const sqlCommands = await this.getUpsertTablesSQL(cls);
    for (const key of ['dropIndex', 'table', 'createIndex'] as const) {
      for (const command of sqlCommands[key]) {
        await this.#exec(command);
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