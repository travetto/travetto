import { Class } from '@travetto/registry';
import { BindUtil, SchemaValidator, DEFAULT_VIEW, SchemaRegistry, ValidationError } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { Env, Util, BaseError } from '@travetto/base';

import { QueryVerifierService } from './verify';
import { ModelOptions } from '../types';
import { Query, ModelQuery, PageableModelQuery, PageableModelQueryStringQuery } from '../model/query';
import { ModelCore } from '../model/core';
import { BulkOp, BulkResponse } from '../model/bulk';
import { ModelSource, IModelSource } from './source';
import { ModelRegistry } from '../registry';
import { QueryLanguageParser } from '../query-lang/parser';
import { ValidationErrors } from '../error';

function getClass<T>(o: T) {
  return o.constructor as Class<T>;
}

@Injectable({ target: ModelService })
export class ModelService implements IModelSource {

  constructor(private source: ModelSource, private queryService: QueryVerifierService) {
  }

  prepareQuery<T>(cls: Class<T>, query: Query<T>) {
    this.queryService.verify(cls, query);
  }

  postConstruct() {
    // Cannot block on registry since this is an injectable (circular dep)
    //   Call but ignore return
    this.init();
  }

  async init() {
    await ModelRegistry.init();
    if (Env.watch) {
      if (this.source.onSchemaChange) {
        SchemaRegistry.onSchemaChange(event => {
          if (ModelRegistry.has(event.cls)) {
            this.source.onSchemaChange!(event);
          }
        });
      }
      if (this.source.onChange) {
        ModelRegistry.on(this.source.onChange.bind(this.source));
      }
    }
  }

  /** Handles subtyping on polymorphic endpoints */
  convert<T extends ModelCore>(cls: Class<T>, o: T) {
    const config = ModelRegistry.get(cls);

    let cons = cls;

    if (config && config.subtypes && !!o.type) {
      cons = config.subtypes[o.type];
    }

    if (o instanceof cons) {
      return o;
    } else {
      return BindUtil.bindSchema(cons, new cons(), o);
    }
  }

  /** Handles any pre-persistance activities needed */
  async prePersist<T extends ModelCore>(cls: Class<T>, o: T): Promise<T>;
  async prePersist<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string): Promise<Partial<T>>;
  async prePersist<T extends ModelCore>(cls: Class<T>, o: Partial<T> | T, view: string = DEFAULT_VIEW) {
    if (o.prePersist) {
      o.prePersist();
    }
    let res = await SchemaValidator.validate(o, view);
    res = await this.source.prePersist(cls, res);
    return res as T;
  }

  /** Handles any pre-retrieval activities needed */
  postLoad<T extends ModelCore>(cls: Class<T>, o: T): T;
  postLoad<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string): Partial<T>;
  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    o = this.source.postLoad(cls, o) as T;
    o = this.convert(cls, o);

    if (o.postLoad) {
      o.postLoad();
    }
    return o;
  }

  /** Executes a raw query against the model space */
  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    this.prepareQuery(cls, query);

    const res = await this.source.query<T, U>(cls, query);
    return res.map(o => this.postLoad(cls, o as any as T) as any as U);
  }

  async getAllByQueryString<T extends ModelCore>(cls: Class<T>, query: PageableModelQueryStringQuery<T>) {
    const where = QueryLanguageParser.parse(query.query);
    const final = { where, ...query };
    return this.getAllByQuery(cls, final);
  }

  /** Retrieves all instances of cls that match query */
  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    const config = ModelRegistry.get(cls) as ModelOptions<T>;
    if (!query.sort && config.defaultSort) {
      query.sort = config.defaultSort;
    }
    const res = await this.source.getAllByQuery(cls, query);
    return res.map(o => this.postLoad(cls, o));
  }

  /** Find the count of matching documetns by query */
  getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    return this.source.getCountByQuery(cls, query);
  }

  /** Find one by query, fail if not found */
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}, failOnMany: boolean = true) {
    this.prepareQuery(cls, query);

    const res = await this.source.getByQuery(cls, query, failOnMany);
    return this.postLoad(cls, res);
  }

  /** Save or update, upsert, for a document */
  async saveOrUpdate<T extends ModelCore>(cls: Class<T>, o: T, query: ModelQuery<T>) {
    this.prepareQuery(cls, query);

    const res = await this.getAllByQuery(getClass(o), { ...query, limit: 2 });
    if (res.length === 1) {
      o = Util.deepAssign(res[0], o);
      return await this.update(cls, o);
    } else if (res.length === 0) {
      return await this.save(cls, o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  /** Find one by id */
  async getById<T extends ModelCore>(cls: Class<T>, id: string) {
    const res = await this.source.getById(cls, id);
    return this.postLoad(cls, res);
  }

  /** Delete one by id */
  deleteById<T extends ModelCore>(cls: Class<T>, id: string) {
    return this.source.deleteById(cls, id);
  }

  /** Delete all by query */
  deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    return this.source.deleteByQuery(cls, query);
  }

  /** Save a new instance */
  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId?: boolean) {
    o = await this.prePersist(cls, o);
    const res = await this.source.save(cls, o, keepId);
    return this.postLoad(cls, res);
  }

  /** Save all as new instances */
  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[], keepId?: boolean) {
    objs = await Promise.all(objs.map(o => this.prePersist(cls, o)));
    const res = await this.source.saveAll(cls, objs, keepId);
    return res.map(x => this.postLoad(cls, x));
  }

  /** Update/replace an existing record */
  async update<T extends ModelCore>(cls: Class<T>, o: T) {
    o = await this.prePersist(cls, o);
    const res = await this.source.update(cls, o);
    return this.postLoad(cls, res);
  }

  /** Update/replace all with partial data, by query */
  updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {
    this.prepareQuery(cls, query);

    return this.source.updateAllByQuery(cls, query, data);
  }

  /** Partial update single record, by id */
  async updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>) {
    this.prePersist(cls, model);

    const res = await this.source.updatePartial(cls, model);

    return this.postLoad(cls, res);
  }

  /** Partial update, by query*/
  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, body: Partial<T>) {
    this.prepareQuery(cls, query);

    // Do not do pre-persist, because we don't know what we would be validating
    const res = await this.source.updatePartialByQuery(cls, query, body);

    return this.postLoad(cls, res);
  }

  /** Partial update single record, by view and by id */
  async updatePartialView<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string) {
    o = await this.prePersist(cls, o, view);

    const partial = BindUtil.bindSchema(cls, {}, o, view);
    const res = await this.source.updatePartial(cls, partial);

    return this.postLoad(cls, res);
  }

  /** Partial update by view and by query */
  async updatePartialViewByQuery<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string, query: ModelQuery<T>) {
    this.prepareQuery(cls, query);

    o = await this.prePersist(cls, o, view);
    const partial = BindUtil.bindSchema(cls, {}, o, view);
    const res = await this.source.updatePartialByQuery(cls, query, partial);

    return this.postLoad(cls, res);
  }

  async bulkPrepare<T extends ModelCore>(cls: Class<T>, items: T[]) {
    const errs: { idx: number, error: ValidationErrors }[] = [];
    const out: { idx: number, v: T }[] = [];

    await Promise.all(
      items.map((x, idx) =>
        this.prePersist(cls, x)
          .then(v => out.push({ idx, v }))
          .catch(error => errs.push({ idx, error }))));

    if (errs.length) {
      throw new BaseError('Bulk Preparation Errors', errs.sort((a, b) => a.idx - b.idx));
    }

    return out
      .sort((a, b) => a.idx - b.idx)
      .map(x => x.v);
  }

  /** Bulk create/update/delete */
  async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[], batchSize?: number) {

    if (!batchSize) {
      batchSize = operations.length;
    }

    const upper = Math.trunc(Math.ceil(operations.length / batchSize));
    const out: BulkResponse = {
      errors: [],
      counts: {
        insert: 0,
        update: 0,
        upsert: 0,
        delete: 0,
        error: 0
      }
    };

    for (let i = 0; i < upper; i++) {
      const start = i * batchSize;
      const end = Math.min(operations.length, (i + 1) * batchSize);

      const res = await this.source.bulkProcess(cls, operations.slice(start, end));

      out.errors.push(...res.errors);
      out.counts.insert += res.counts.insert;
      out.counts.upsert += res.counts.upsert;
      out.counts.update += res.counts.update;
      out.counts.delete += res.counts.delete;
      out.counts.error += res.counts.error;
    }
    return out;
  }
}