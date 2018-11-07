import * as sequelize from 'sequelize';

import {
  ModelSource, Query,
  QueryOptions, BulkResponse, BulkOp,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  ModelQuery
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { Env, BaseError } from '@travetto/base';
import { SchemaChangeEvent, SchemaRegistry } from '@travetto/schema';

import { ModelSqlConfig } from './config';
import { SqlUtil } from './util';

export class ModelSqlSource extends ModelSource {

  // private indices: { [key: string]: IndexConfig<any>[] } = {};
  public sequelize: sequelize.Sequelize;

  constructor(private config: ModelSqlConfig) {
    super();
  }

  private getIncludes<T>(cls: Class<T>, fields?: string[]): any[] {
    const view = SchemaRegistry.getViewSchema(cls);

    const includes = [];
    for (const f of (fields || view.fields)) {
      const fcls = view.schema[f].type;
      if (SchemaRegistry.has(fcls)) {
        includes.push({
          model: this.getModel(fcls),
          include: this.getIncludes(fcls)
        });
      }
    }
    return includes;
  }

  private setSelect<T>(cls: Class<T>, query: Query<T>, search: sequelize.FindOptions<T>) {
    const view = SchemaRegistry.getViewSchema(cls);
    if (query.select) {
      const [inc, exc] = SqlUtil.getSelect(query.select);
      if (inc.length) {
        search.attributes = inc;
      } else if (exc.length) {
        const toRemove = new Set(exc);
        search.attributes = view.fields.filter(f => !toRemove.has(f));
      }
    }

    const includes = this.getIncludes(cls, search.attributes as string[]);

    if (includes.length) {
      search.include = includes;
    }
  }

  private setOptions<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T>,
    opts: sequelize.FindOptions<T>) {
    const conf = ModelRegistry.get(cls);

    const sort = options.sort || query.sort || conf.defaultSort;

    if (sort) {
      opts.order = sort.map(x => {
        const o = SqlUtil.extractSimple(x);
        const k = Object.keys(o)[0];
        const v = o[k] as (boolean | -1 | 1);
        if (v === 1 || v === true) {
          return [k, 'ASC'];
        } else {
          return [k, 'DESC'];
        }
      });
    }

    if (options.offset || query.offset) {
      opts.offset = options.offset || query.offset;
    }

    if (options.limit || query.limit) {
      opts.limit = options.limit || query.limit;
    }
  }

  private getFindOptions<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}): sequelize.FindOptions<T> {
    const opts: sequelize.FindOptions<T> = {};
    this.setSelect(cls, query, opts);
    opts.where = SqlUtil.extractWhereClause(query.where || {}) as sequelize.WhereOptions<T>;
    this.setOptions(cls, query, options, opts);
    return opts;
  }

  private getDestroyOptions<T>(cls: Class<T>, query: Query<T>): sequelize.DestroyOptions {
    const opts: sequelize.DestroyOptions = {};
    opts.where = SqlUtil.extractWhereClause(query.where || {});
    opts.limit = query.limit;
    return opts;
  }

  private getCountOptions<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}): sequelize.CountOptions {
    const opts: sequelize.DestroyOptions = {};
    opts.where = SqlUtil.extractWhereClause(query.where || {});
    return opts;
  }

  private getUpdateOptions<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}): sequelize.UpdateOptions {
    const opts: sequelize.UpdateOptions = { where: {} };
    opts.where = SqlUtil.extractWhereClause(query.where || {});
    return opts;
  }


  async onSchemaChange(e: SchemaChangeEvent) {
    await this.sequelize.sync({ alter: true });
  }

  onChange<T extends ModelCore>(e: ChangeEvent<Class<T>>): void {
    console.debug('Model Changed', e);

    // Handle ADD/REMOVE
    if (e.prev && !e.curr) { // Removing
      this.sequelize.dropSchema(e.prev.__id.toLowerCase(), {});
    }
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const results = await this.getModel(cls).findAll({
      ...this.getFindOptions(cls, query),
    });
    return results as any as U[];
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    if ((o as any)._id) {
      o.id = (o as any)._id as string;
      delete (o as any)._id;
    }
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    if (o.id) {
      (o as any)._id = o.id as string;
      delete o.id;
    }
    return o;
  }

  async postConstruct() {
    await this.init();
  }

  getModel<T extends ModelCore>(cls: Class<T>) {
    return this.sequelize.model(cls.name.toLowerCase()) as sequelize.Model<T, any>;
  }

  async init() {
    this.sequelize = new sequelize(this.config.namespace, {
      dialect: this.config.dialect,
      port: this.config.port,
      host: this.config.host,
      username: this.config.username,
      password: this.config.password,
      ...this.config.options
    });

    // PreCreate indexes if missing
    if (!Env.prod) {
      await this.onSchemaChange(undefined as any);
    }
  }

  async resetDatabase() {
    await this.sequelize.dropAllSchemas({});
    await this.init();
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>) {
    const opts = this.getFindOptions(cls, query);
    opts.attributes = ['id'];

    const res = await this.getModel(cls).findAll(opts);
    return res.map(x => x.id);
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    return this.query(cls, query);
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const results = await this.getModel(cls).count(this.getCountOptions(cls, query, {
      limit: 0
    }) as sequelize.CountOptions);
    return results;
  }
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 2, ...query });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new BaseError(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    try {
      const res = await this.getModel(cls).findById(id, {
        limit: 1,
        raw: true,
        rejectOnEmpty: true
      });
      return res as T;
    } catch (err) {
      throw new BaseError(`Invalid number of results for find by id: 0`);
    }
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const res = await this.getModel(cls).destroy({
      where: {
        id
      }
    });
    return res;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const res = await this.getModel(cls).destroy(
      this.getDestroyOptions(cls, query) as sequelize.DestroyOptions
    );
    return res || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId: boolean = false): Promise<T> {
    if (!keepId) {
      delete o.id;
    }
    this.prePersist(cls, o);

    const res = await this.getModel(cls).create(o, {
      validate: false,
      raw: true,
      isNewRecord: true,
    });

    o.id = res.id;
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[], keepId: boolean = false): Promise<T[]> {
    for (const x of objs) {
      if (!keepId) {
        delete x.id;
      }
      this.prePersist(cls, x);
    }

    await this.bulkProcess(cls, objs.map(x => ({ upsert: x })));

    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    const query = this.getUpdateOptions(cls, {
      where: { id: o.id }
    } as Query<ModelCore>);

    const [count, res] = await this.getModel(cls).update(o, {
      sideEffects: false,
      validate: false,
      ...query
    });
    return res[0];
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    const id = data.id;
    delete data.id;

    const query = this.getUpdateOptions(cls, { where: { id } } as Query<ModelCore>);
    query.fields = Object.keys(data);

    const [res, o] = await this.getModel(cls).update({
      sideEffects: false,
      validate: false,
      ...query
    });

    return o[0];
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    if (!data.id) {
      const item = await this.getByQuery(cls, query);
      data.id = item.id;
    }
    return await this.updatePartial(cls, data as any);
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, data: Partial<T>) {
    const allQuery = this.getUpdateOptions(cls, query);

    allQuery.fields = Object.keys(data);

    const [count, res] = await this.getModel(cls).update({
      sideEffects: false,
      validate: false,
      ...allQuery
    });

    return count;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]) {
    const tx = await this.sequelize.transaction();

    const deletes = operations.filter(x => x.delete).map(x => x.delete!);
    const updates = operations.filter(x => x.update).map(x => x.update!);
    const inserts = operations.filter(x => x.insert).map(x => x.insert!);
    const upserts = operations.filter(x => x.upsert).map(x => x.upsert!);

    const model = this.getModel(cls);

    if (deletes.length) {
      await model.destroy({
        ...this.getDestroyOptions(cls, { id: { $in: deletes.map(x => x.id!) } } as Query<T>) as sequelize.DestroyOptions,
        transaction: tx
      });
    }


    if (inserts.length) {
      await Promise.all(inserts.map(x => model.create(x, {
        isNewRecord: true,
        raw: true,
        validate: false,
        transaction: tx
      })))
    }

    if (updates.length) {
      await Promise.all(updates.map(x => model.update(x, {
        sideEffects: false,
        validate: false,
        transaction: tx,
        ...this.getUpdateOptions(cls, {
          where: { id: x.id! }
        } as Query<ModelCore>) as sequelize.UpdateOptions
      })));
    }

    if (upserts.length) {
      await Promise.all(upserts.map(x => model.upsert(x, {
        transaction: tx,
        validate: false
      })))
    }

    const out: BulkResponse = {
      counts: {
        delete: deletes.length,
        insert: inserts.length,
        upsert: upserts.length,
        update: updates.length,
        error: 0
      },
      errors: []
    };

    await tx.commit();

    return out;
  }
}