import {
  ModelSource,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  ModelQuery, Query,
  BulkOp, BulkResponse,
  ValidStringFields, WhereClauseRaw
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { AppError } from '@travetto/base';
import { SchemaChangeEvent, SchemaRegistry, FieldConfig } from '@travetto/schema';
import { AsyncContext, WithAsyncContext } from '@travetto/context';

import { SQLModelConfig } from './config';
import { SQLDialect } from './dialect/base';
import { Connected } from './dialect/connection';
import { Injectable } from '@travetto/di';

/**
 * Core for SQL Model Source.  Should not have any direct queries,
 * but should offload all of that to the dialect, so it can be overridden
 * as needed.
 */
@Injectable()
export class SQLModelSource extends ModelSource {

  constructor(
    public context: AsyncContext,
    private config: SQLModelConfig,
    private dialect: SQLDialect
  ) {
    super();
  }

  get conn() {
    return this.dialect.conn;
  }

  generateId() {
    return this.dialect.generateId();
  }

  @Connected(true)
  createTables(cls: Class<any>): Promise<void> {
    return this.dialect.visitSchema(cls, {
      onRoot: async ({ table, fields, descend }) => {
        let idField = fields.find(x => x.name === this.dialect.ID_FIELD);
        if (!idField) {
          fields.push(idField = {
            name: this.dialect.ID_FIELD,
            type: String,
            required: { active: true },
            array: false,
            owner: null
          });
        }
        await this.dialect.executeSQL(this.dialect.createPrimaryTableSQL(table, fields));
        return descend();
      },
      onSub: async ({ table, fields, parentTable, descend }) => {
        await this.dialect.executeSQL(this.dialect.createSubTableSQL(table, fields, parentTable));
        return descend();
      },
      onSimple: async ({ config, parentTable, table }) => {
        await this.dialect.executeSQL(this.dialect.createSimpleTableSQL(table, config, parentTable));
      }
    });
  }

  @Connected(true)
  async dropTables(cls: Class<any>): Promise<void> {
    return this.dialect.visitSchema(cls, {
      onSimple: ({ table }) => this.dialect.executeSQL(this.dialect.dropTableSQL(table)),
      onSub: async ({ table, descend }) => {
        await descend();
        await this.dialect.executeSQL(this.dialect.dropTableSQL(table));
      },
      onRoot: async ({ table, descend }) => {
        await descend();
        await this.dialect.executeSQL(this.dialect.dropTableSQL(table));
      }
    });
  }

  async insertSingle(table: string, path: string[], fields: FieldConfig[], instance: any) {
    const columns = fields
      .filter(x => x.name in instance)
      .filter(x => !SchemaRegistry.has(x.type) && !x.array)
      .sort((a, b) => a.name.localeCompare(b.name));

    const values = columns.map(x => this.dialect.resolveValue(x, instance[x.name]));

    const columnNames = columns.map(x => x.name);
    columnNames.unshift(this.dialect.PATH_ID);
    values.unshift(this.dialect.hash(path.join('.')));

    if (path.length > 1) {
      columnNames.unshift(this.dialect.PARENT_PATH_ID);
      values.unshift(this.dialect.hash(path.slice(0, path.length - 1).join('.')));
    }

    await this.dialect.insertRows(table, columnNames, [values]);
  }

  @WithAsyncContext({})
  @Connected(true)
  async initializeDatabase() {
    for (const cls of ModelRegistry.getClasses()) {
      await this.createTables(cls);
    }
  }

  @WithAsyncContext({})
  @Connected(true)
  async clearDatabase() {
    for (const cls of ModelRegistry.getClasses()) {
      try {
        await this.dropTables(cls);
      } catch {
        // Ignore
      }
    }
  }

  async postConstruct() {
    if (this.conn.init) {
      await this.conn.init();
    }
    if (this.config.autoCreate) {
      await this.initializeDatabase();
    }
  }

  async onSchemaChange(ev: SchemaChangeEvent) {
    this.dialect.handleFieldChange(ev);
  }

  onChange<T extends ModelCore>(e: ChangeEvent<Class<T>>): void {
    console.debug('Model Changed', e);

    if (!this.config.autoCreate) {
      return;
    }

    // Handle ADD/REMOVE
    if (e.prev && !e.curr) { // Removing
      this.dropTables(e.prev);
    } else if (e.curr && !e.prev) { // Adding
      this.createTables(e.curr!);
    }
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    return o;
  }

  async suggestField<T extends ModelCore, U = T>(
    cls: Class<T>, field: ValidStringFields<T>, query: string, filter?: PageableModelQuery<T>
  ): Promise<U[]> {
    if (!filter) {
      filter = {};
    }
    filter.limit = filter.limit || 10;
    const suggestQuery = {
      [field]: new RegExp(`\\b${query}`, 'i')
    } as any as WhereClauseRaw<T>;

    if (!filter.where) {
      filter.where = suggestQuery;
    } else {
      filter.where = {
        $and: [
          filter.where,
          suggestQuery
        ]
      } as WhereClauseRaw<T>;
    }
    return this.query(cls, filter);
  }

  @Connected()
  async insert<T = any>(cls: Class, instance: T) {
    return this.dialect.visitSchemaInstance(cls, instance, {
      onRoot: ({ table, fields, value, path }) => this.insertSingle(table, path, fields, value),
      onSub: ({ table, fields, value, path }) => this.insertSingle(table, path, fields, value),
      onSimple: async ({ table, config: field, value, parentTable, path }) => {
        if (Array.isArray(value)) {
          await this.dialect.insertRows(table, [this.dialect.PARENT_PATH_ID, this.dialect.PATH_ID, field.name], value.map((v, i) =>
            [this.dialect.hash(parentTable), this.dialect.hash(`${path.join('.')}[${i}]`), this.dialect.resolveValue(field, v)]
          ));
        }
      }
    });
  }

  @Connected(true)
  async save<T extends ModelCore>(cls: Class<T>, model: T, keepId?: boolean): Promise<T> {
    if (!keepId || !model.id) {
      model.id = this.dialect.generateId();
    }

    await this.insert(cls, model);

    return model;
  }

  @Connected(true)
  async saveAll<T extends ModelCore>(cls: Class<T>, models: T[], keepId?: boolean): Promise<T[]> {
    for (const model of models) {
      if (!keepId || !model.id) {
        model.id = this.dialect.generateId();
      }
    }

    await this.bulkProcess(cls, models.map(x => ({ insert: x })));

    return models;
  }

  @Connected(true)
  async update<T extends ModelCore>(cls: Class<T>, model: T): Promise<T> {
    await this.deleteById(cls as Class<T & { id: string }>, model.id!);
    return await this.save(cls, model, true);
  }

  @Connected(true)
  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    return this.dialect.updateRows(
      this.dialect.namespace(cls), data as Record<string, any>,
      await this.dialect.buildFrom(cls, query)
    );
  }

  @Connected(true)
  async updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Promise<T> {
    return this.update(cls, model as T);
  }

  @Connected(true)
  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    if (!data.id) {
      const item = await this.getByQuery(cls, query);
      this.postLoad(cls, item);
      data.id = item.id;
    }
    return await this.updatePartial(cls, data as any);
  }

  @Connected()
  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    const res = await this.query(cls, query);
    try {
      await this.dialect.fetchDependents(cls, res);
    } catch (err) {
      console.log(err);
    }
    return res;
  }

  @Connected()
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 2, ...query });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new AppError(`Invalid number of results for find by id: ${res ? res.length : res}`, 'data');
    }
    return res[0] as T;
  }

  @Connected()
  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    try {
      const res = await this.getByQuery(cls, { where: { id } } as any as ModelQuery<T>);
      return res;
    } catch (err) {
      throw new AppError(`Invalid number of results for find by id: 0`, 'notfound');
    }
  }

  @Connected(true)
  async deleteById<T extends ModelCore>(cls: Class<T & { id: string }>, id: string): Promise<number> {
    return this.deleteByQuery(cls, { where: { id } } as ModelQuery<ModelCore>);
  }

  @Connected()
  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return this.dialect.getCountForQuery(cls, query);
  }

  @Connected()
  query<T extends ModelCore, U = T>(cls: Class<T>, builder: Query<T>): Promise<U[]> {
    return this.dialect.query(cls, builder);
  }

  @Connected(true)
  bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse> {
    return this.dialect.bulkProcess(cls, operations);
  }

  @Connected(true)
  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return this.dialect.deleteAndGetCount(cls, query);
  }
}