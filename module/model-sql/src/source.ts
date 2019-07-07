import {
  ModelSource,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  ModelQuery, Query,
  BulkOp, BulkResponse,
  ValidStringFields, WhereClauseRaw
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { AppError, Util } from '@travetto/base';
import { SchemaChangeEvent, SchemaRegistry, FieldConfig } from '@travetto/schema';
import { AsyncContext, WithAsyncContext } from '@travetto/context';

import { SQLModelConfig } from './config';
import { Connected } from './dialect/connection';
import { Injectable } from '@travetto/di';
import { SQLUtil } from './util';
import { SQLDialect } from './dialect/dialect';

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
    return SQLUtil.visitSchema(SchemaRegistry.get(cls), {
      onRoot: ({ path, descend }) => this.dialect.executeSQL(this.dialect.getCreateTableSQL(path)).then(descend),
      onSub: ({ path, descend }) => this.dialect.executeSQL(this.dialect.getCreateTableSQL(path)).then(descend),
      onSimple: ({ path }) => this.dialect.executeSQL(this.dialect.getCreateTableSQL(path))
    });
  }

  @Connected(true)
  async dropTables(cls: Class<any>): Promise<void> {
    return SQLUtil.visitSchema(SchemaRegistry.get(cls), {
      onRoot: ({ path, descend }) => descend().then(() => this.dialect.executeSQL(this.dialect.getDropTableSQL(path))),
      onSub: ({ path, descend }) => descend().then(() => this.dialect.executeSQL(this.dialect.getDropTableSQL(path))),
      onSimple: ({ path }) => this.dialect.executeSQL(this.dialect.getDropTableSQL(path))
    });
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
    if (this.dialect.handleFieldChange) {
      this.dialect.handleFieldChange(ev);
    }
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
      [field]: {
        $regex: new RegExp(`\\b${query}.*`, 'i')
      }
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
    return SQLUtil.visitSchemaInstance(cls, instance, {
      onRoot: ({ value, path }) => {
        return this.dialect.executeSQL(this.dialect.getInsertSQL(path, [value]));
      },
      onSub: ({ value, path }) => {
        const { index } = path[path.length - 1];
        return this.dialect.executeSQL(this.dialect.getInsertSQL(path, [value], index));
      },
      onSimple: ({ value, path }) => {
        return this.dialect.executeSQL(this.dialect.getInsertSQL(path, value as any[]));
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
    const final = await this.getById(cls, model.id!);
    Util.deepAssign(final, model, 'replace');
    return this.update(cls, final);
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
      throw new AppError(`Invalid number of results for find by id: ${err.message}`, 'notfound');
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
  async query<T extends ModelCore, U = T>(cls: Class<T>, builder: Query<T>): Promise<U[]> {
    const res = await this.dialect.executeSQL(this.dialect.getQuerySQL(cls, builder));
    if (ModelRegistry.has(cls)) {
      await this.dialect.fetchDependents(cls, res, builder && builder.select);
    }
    SQLUtil.cleanResults(this.dialect, res);
    return res as any as U[];
  }

  @Connected(true)
  async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse> {
    const deleteOps = operations.map(x => x.delete).filter(x => !!x) as T[];
    const insertOps = operations.map(x => x.insert).filter(x => !!x) as T[];

    for (const el of insertOps) {
      if (!el.id) {
        el.id = this.generateId();
      }
    }

    const deletes = [{ type: cls, ids: deleteOps.map(x => x.id!) }].filter(x => !!x.ids.length);
    const inserts = (await SQLUtil.extractInserts(this.dialect, cls, insertOps)).filter(x => !!x.records.length);
    const upserts = (await SQLUtil.extractInserts(this.dialect, cls, operations.map(x => x.upsert).filter(x => !!x))).filter(x => !!x.records.length);
    const updates = (await SQLUtil.extractInserts(this.dialect, cls, operations.map(x => x.update).filter(x => !!x))).filter(x => !!x.records.length);


    let out = {} as BulkResponse;

    if (this.dialect.bulkProcess) {
      out = await this.dialect.bulkProcess(deletes, inserts, upserts, updates);
    } else {
      out = {
        counts: {
          delete: deletes.filter(x => x.level === 1).reduce((acc, el) => acc + el.ids.length, 0),
          error: 0,
          insert: insertOps.filter(x => x.level === 1).reduce((acc, el) => acc + el.records.length, 0),
          update: updates.filter(x => x.level === 1).reduce((acc, el) => acc + el.records.length, 0),
          upsert: upserts.filter(x => x.level === 1).reduce((acc, el) => acc + el.records.length, 0)
        },
        errors: [],
        insertedIds: new Map()
      };

      // Full removals
      await Promise.all(deletes.map(d => this.deleteByIds(d.table, d.ids)));

      // Adding deletes
      if (upserts.length || updates.length) {
        await Promise.all([
          ...upserts.filter(x => x.level === 1).map(i => {
            const idx = i.fields.indexOf(this.idField.name);
            return this.deleteByIds(i.table, i.records.map(v => v[idx]))
          }),
          ...updates.filter(x => x.level === 1).map(i => {
            const idx = i.fields.indexOf(this.idField.name);
            return this.deleteByIds(i.table, i.records.map(v => v[idx]))
          }),
        ]);
      }

      // Adding
      for (const items of [insertOps, upserts, updates]) {
        if (!items.length) {
          continue;
        }
        let lvl = 1; // Add by level
        while (true) {
          const leveled = items.filter(f => f.level === lvl);
          if (!leveled.length) {
            break;
          }
          await Promise.all(leveled.map(iw => this.insertRows(iw.table, iw.fields, iw.records)))
          lvl += 1;
        }
      }
    }

    return out;
  }

  @Connected(true)
  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return this.dialect.deleteAndGetCount(cls, query);
  }
}