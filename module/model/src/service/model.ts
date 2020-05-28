import { Class } from '@travetto/registry';
import { BindUtil, SchemaValidator, ALL_VIEW } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { Util, AppError } from '@travetto/base';
import { Watchable } from '@travetto/base/src/internal/watchable';

import { QueryVerifierService } from './verify';
import { ModelOptions } from '../registry/types';
import { Query, ModelQuery, PageableModelQuery, PageableModelQueryStringQuery } from '../model/query';
import { ModelCore } from '../model/core';
import { BulkOp, BulkResponse, BulkProcessError } from '../model/bulk';
import { ModelSource, IModelSource, ValidStringFields } from './source';
import { ModelRegistry } from '../registry/registry';
import { QueryLanguageParser } from '../internal/query-lang/parser';

// @ts-ignore
const getClass = <T>(o: T) => o.constructor as Class<T>;

/**
 * Model Service, takes in a model source as provided by various db implementations
 */
@Watchable('@travetto/model/support/watch.schema')
@Injectable({ target: ModelService })
export class ModelService implements IModelSource {

  constructor(private source: ModelSource, private queryService: QueryVerifierService) { }

  /**
   * Prepare the query
   */
  prepareQuery<T>(cls: Class<T>, query: Query<T>) {
    this.queryService.verify(cls, query);
  }

  /**
   * Run on post service construction
   */
  postConstruct() {
    // Cannot block on registry since this is an injectable (circular dep)
    //   Call but ignore return
    this.init();
  }

  /**
   * Generate a new id
   */
  generateId() {
    return this.source.generateId();
  }

  /**
   * Initialize the model registry
   */
  async init() {
    await ModelRegistry.init();
  }

  /**
   * Handles subtyping on polymorphic endpoints
   */
  convert<T extends ModelCore>(cls: Class<T>, o: T) {
    return BindUtil.bindSchema(cls, o);
  }

  /**
   * Handles any pre-persistance activities needed
   */
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

  /**
   * Handle pre persistence for partial updates.
   */
  async prePersistPartial<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view?: string) {
    if (!(o instanceof cls)) {
      throw new Error(`Expected object of type ${cls.name}, but received ${o.constructor.name}`);
    }

    // Do not call source or instance prePersist

    return await SchemaValidator.validatePartial(o, view);
  }

  /**
   * Handles any pre-retrieval activities needed
   */
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

  /**
   * Suggest for a given cls and a given field
   *
   * @param cls The model class to suggest on
   * @param field The field to suggest on
   * @param prefix The search prefix for the given field
   * @param query A query to filter the search on, in addition to the prefix
   */
  suggest<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    return this.source.suggest(cls, field, prefix, query);
  }

  /**
   * Facet a given class on a specific field, limited by an optional query
   * @param cls The model class to facet on
   * @param field The field to facet on
   * @param query Additional query filtering
   */
  facet<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    return this.source.facet(cls, field, query);
  }

  /**
   * Suggest a set of entities (allows for duplicates with as long as they have different ids)
   * @param cls The model class to suggest against
   * @param field The field to suggest against
   * @param prefix The field prefix to search on
   * @param query Additional query filtering
   */
  async suggestEntities<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const results = await this.source.suggestEntities(cls, field, prefix, query);
    return results.map(x => this.postLoad(cls, x));
  }

  /**
   Executes a raw query against the model space
   * @param cls The model class
   * @param query The query to execute
   */
  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    this.prepareQuery(cls, query);

    const res = await this.source.query<T, U>(cls, query);
    // @ts-ignore
    return res.map(o => this.postLoad(cls, o as T) as U);
  }

  /**
   * Executes a query string using the query language
   * @param cls The model class
   * @param query The query string to execute
   */
  async getAllByQueryString<T extends ModelCore>(cls: Class<T>, query: PageableModelQueryStringQuery<T>) {
    const where = QueryLanguageParser.parseToQuery(query.query);
    const final = { where, ...query };
    return this.getAllByQuery(cls, final);
  }

  /**
   * Retrieves all instances of cls that match query
   * @param cls The model class
   * @param query The query to search against
   */
  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    const config = ModelRegistry.get(cls) as ModelOptions<T>;
    if (!query.sort && config.defaultSort) {
      query.sort = config.defaultSort;
    }
    const res = await this.source.getAllByQuery(cls, query);
    const ret = await Promise.all(res.map(o => this.postLoad(cls, o)));
    return ret;
  }

  /**
   * Find the count of matching documents by query.
   * @param cls The model class
   * @param query The query to count for
   */
  getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    return this.source.getCountByQuery(cls, query);
  }

  /**
   * Find one by query, fail if not found
   * @param cls The model class
   * @param query The query to search for
   * @param failOnMany Should the query fail on more than one result found
   */
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}, failOnMany: boolean = true) {
    this.prepareQuery(cls, query);

    const res = await this.source.getByQuery(cls, query, failOnMany);
    return this.postLoad(cls, res);
  }

  /**
   * Save or update, upsert, for a document
   * @param cls The model class
   * @param o The object to save
   * @param query The query to use to determine save vs update
   */
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

  /**
   * Find one by id
   * @param cls The model class
   * @param id The id to search for
   */
  async getById<T extends ModelCore>(cls: Class<T>, id: string) {
    const res = await this.source.getById(cls, id);
    return this.postLoad(cls, res);
  }

  /**
   * Delete one by id
   * @param cls The model class
   * @param id The id to delete
   */
  deleteById<T extends ModelCore>(cls: Class<T>, id: string) {
    return this.source.deleteById(cls, id);
  }

  /**
   * Delete all by query
   * @param cls The model class
   * @param query Query to search for deletable elements
   */
  deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    return this.source.deleteByQuery(cls, query);
  }

  /**
   * Save a new instance
   * @param cls The model class
   * @param o The object to save
   * @param keepId Should the id be preserved, if found
   */
  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId?: boolean) {
    o = await this.prePersist(cls, o);
    const res = await this.source.save(cls, o, keepId);
    return this.postLoad(cls, res);
  }

  /**
   * Save all as new instances
   * @param cls The model class
   * @param objs The objects to save
   * @param keepId Should the ids be preserved, if found
   */
  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[], keepId?: boolean) {
    objs = await Promise.all(objs.map(o => this.prePersist(cls, o)));
    const res = await this.source.saveAll(cls, objs, keepId);
    return Promise.all(res.map(x => this.postLoad(cls, x)));
  }

  /**
   * Update/replace an existing record
   * @param cls The model class
   * @param o The object to update
   */
  async update<T extends ModelCore>(cls: Class<T>, o: T) {
    o = await this.prePersist(cls, o);
    const res = await this.source.update(cls, o);
    return this.postLoad(cls, res);
  }

  /**
   * Update/replace all with partial data, by query
   * @param cls The model class
   * @param query The query to search for
   * @param data The partial data
   */
  updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {
    this.prepareQuery(cls, query);

    return this.source.updateAllByQuery(cls, query, data);
  }

  /**
   * Partial update single record, by id
   * @param cls The model class
   * @param o The object, with an id, to update
   */
  async updatePartial<T extends ModelCore>(cls: Class<T>, o: Partial<T>) {
    if (!o.id) {
      throw new AppError('Id is required for a partial update', 'data');
    }

    // Do not do a standard pre-persist, because we don't know what we would be validating
    await this.prePersistPartial(cls, o);

    const res = await this.source.updatePartial(cls, o);

    return this.postLoad(cls, res);
  }

  /**
   * Partial update, by query
   * @param cls The model class
   * @param query The query to search for
   * @param o The partial data
   */
  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, o: Partial<T>) {
    // Do not do a standard pre-persist, because we don't know what we would be validating
    await this.prePersistPartial(cls, o);

    this.prepareQuery(cls, query);

    const res = await this.source.updatePartialByQuery(cls, query, o);

    return this.postLoad(cls, res);
  }

  /**
   * Partial update single record, by view and by id
   * @param cls The model class
   * @param o The object to update by view
   * @param view The view to update
   */
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

  /**
   * Partial update by view and by query
   * @param cls The model class
   * @param o The partial object
   * @param view The view to enforce
   * @param query The query to find against
   */
  async updatePartialViewByQuery<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string, query: ModelQuery<T>) {
    this.prepareQuery(cls, query);

    o = await this.prePersist(cls, o, view);
    const partial = BindUtil.bindSchemaToObject(cls, {} as T, o, view);
    const res = await this.source.updatePartialByQuery(cls, query, partial);

    return this.postLoad(cls, res);
  }

  /**
   * Prepare the items for bulk processing
   * @param cls The model class
   * @param items The items to bulk update/insert
   */
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

  /**
   * Bulk create/update/delete/upsert
   * @param cls The model class (can be polymorphic)
   * @param operations The list of bulk operations to run
   * @param batchSize The batch size for bulk processing
   */
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