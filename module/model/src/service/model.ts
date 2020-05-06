import { Class } from '@travetto/registry';
import { BindUtil, SchemaValidator, ALL_VIEW } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { Util, AppError } from '@travetto/base';

import { QueryVerifierService } from './verify';
import { ModelOptions } from '../types';
import { Query, ModelQuery, PageableModelQuery, PageableModelQueryStringQuery } from '../model/query';
import { ModelCore } from '../model/core';
import { BulkOp, BulkResponse, BulkProcessError } from '../model/bulk';
import { ModelSource, IModelSource, ValidStringFields } from './source';
import { ModelRegistry } from '../registry';
import { QueryLanguageParser } from '../internal/query-lang/parser';

function getClass<T extends any>(o: T) {
  return o.constructor as Class<T>;
}

// TODO: Document
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

  generateId() {
    return this.source.generateId();
  }

  async init() {
    await ModelRegistry.init();
    /* @inline:watch */ this /* @end */;
  }

  /** Handles subtyping on polymorphic endpoints */
  convert<T extends ModelCore>(cls: Class<T>, o: T) {
    return BindUtil.bindSchema(cls, o);
  }

  /** Handles any pre-persistance activities needed */
  async prePersist<T extends ModelCore>(cls: Class<T>, o: T): Promise<T>;
  async prePersist<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string): Promise<Partial<T>>;
  async prePersist<T extends ModelCore>(cls: Class<T>, o: Partial<T> | T, view: string = ALL_VIEW) {
    if (o.prePersist) {
      await o.prePersist();
    }

    if (!(o instanceof cls)) {
      throw new Error(`Expected object of type ${cls.name}, but received ${o.constructor.name}`);
    }

    let res = await SchemaValidator.validate(o, view);
    res = await this.source.prePersist(cls, res) as T;
    return res;
  }

  async prePersistPartial<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view?: string) {
    if (!(o instanceof cls)) {
      throw new Error(`Expected object of type ${cls.name}, but received ${o.constructor.name}`);
    }

    // Do not call source or instance prePersist

    return await SchemaValidator.validatePartial(o, view);
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

  suggest<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    return this.source.suggest(cls, field, prefix, query);
  }

  facet<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    return this.source.facet(cls, field, query);
  }

  async suggestEntities<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const results = await this.source.suggestEntities(cls, field, prefix, query);
    return results.map(x => this.postLoad(cls, x));
  }

  /** Executes a raw query against the model space */
  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    this.prepareQuery(cls, query);

    const res = await this.source.query<T, U>(cls, query);
    return res.map(o => this.postLoad(cls, o as any as T) as any as U);
  }

  async getAllByQueryString<T extends ModelCore>(cls: Class<T>, query: PageableModelQueryStringQuery<T>) {
    const where = QueryLanguageParser.parseToQuery(query.query);
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
    return Promise.all(res.map(o => this.postLoad(cls, o)));
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
  async saveOrUpdate<T extends ModelCore>(cls: Class<T>, o: T, query: ModelQuery<T> & { keepId?: boolean }) {
    this.prepareQuery(cls, query);

    const res = await this.getAllByQuery(getClass(o), { ...query, limit: 2 });
    if (res.length === 1) {
      o = Util.deepAssign(res[0], o);
      return await this.update(cls, o);
    } else if (res.length === 0) {
      return await this.save(cls, o, query.keepId);
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
    return Promise.all(res.map(x => this.postLoad(cls, x)));
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
  async updatePartial<T extends ModelCore>(cls: Class<T>, o: Partial<T>) {
    if (!o.id) {
      throw new AppError('Id is required for a partial update', 'data');
    }

    // Do not do a standard pre-persist, because we don't know what we would be validating
    await this.prePersistPartial(cls, o);

    const res = await this.source.updatePartial(cls, o);

    return this.postLoad(cls, res);
  }

  /** Partial update, by query*/
  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, o: Partial<T>) {
    // Do not do a standard pre-persist, because we don't know what we would be validating
    await this.prePersistPartial(cls, o);

    this.prepareQuery(cls, query);

    const res = await this.source.updatePartialByQuery(cls, query, o);

    return this.postLoad(cls, res);
  }

  /** Partial update single record, by view and by id */
  async updatePartialView<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string) {
    if (!o.id) {
      throw new AppError('Id is required for a partial update', 'data');
    }

    o = await this.prePersistPartial(cls, o, view);

    const partial = BindUtil.bindSchemaToObject(cls, {} as T, o, view) as Partial<T>;

    if (!partial.id) {
      partial.id = o.id;
    }

    const res = await this.source.updatePartial(cls, partial);

    return this.postLoad(cls, res);
  }

  /** Partial update by view and by query */
  async updatePartialViewByQuery<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string, query: ModelQuery<T>) {
    this.prepareQuery(cls, query);

    o = await this.prePersist(cls, o, view);
    const partial = BindUtil.bindSchemaToObject(cls, {} as T, o, view);
    const res = await this.source.updatePartialByQuery(cls, query, partial);

    return this.postLoad(cls, res);
  }

  async bulkPrepare<T extends ModelCore>(cls: Class<T>, items: T[]) {
    const errs: { idx: number, error: Error }[] = [];
    const out: { idx: number, v: T }[] = [];

    await Promise.all(
      items.map((x, idx) =>
        this.prePersist(cls, x)
          .then(v => out.push({ idx, v }))
          .catch((error) => errs.push({ idx, error }))));

    if (errs.length) {
      throw new BulkProcessError(errs.sort((a, b) => a.idx - b.idx));
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
      },
      insertedIds: new Map()
    };

    for (let i = 0; i < upper; i++) {
      const start = i * batchSize;
      const end = Math.min(operations.length, (i + 1) * batchSize);

      const res = await this.source.bulkProcess(cls, operations.slice(start, end));
      for (const [idx, id] of res.insertedIds.entries()) {
        out.insertedIds.set(idx + start, id);
      }

      out.errors.push(...res.errors);
      out.counts.insert += (res.counts.insert ?? 0);
      out.counts.upsert += (res.counts.upsert ?? 0);
      out.counts.update += (res.counts.update ?? 0);
      out.counts.delete += (res.counts.delete ?? 0);
      out.counts.error += (res.counts.error ?? 0);
    }
    return out;
  }
}