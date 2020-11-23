import { Class } from '@travetto/registry';
import { BindUtil } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { Watchable } from '@travetto/base/src/internal/watchable';
import { ModelRegistry, ModelType, ModelOptions } from '@travetto/model-core';

import { QueryVerifierService } from './verify';
import { Query, ModelQuery, PageableModelQuery, PageableModelQueryStringQuery } from '../model/query';
import { ModelQuerySupport, ValidStringFields } from './source';
import { QueryLanguageParser } from '../internal/query-lang/parser';

/**
 * Model Service, takes in a model source as provided by various db implementations
 */
@Watchable('@trv:model/schema')
@Injectable()
export class ModelService implements ModelQuerySupport {

  constructor(private source: ModelQuerySupport, private queryService: QueryVerifierService) { }

  /**
   * Prepare the query
   */
  prepareQuery<T>(cls: Class<T>, query: Query<T>) {
    this.queryService.verify(cls, query);
  }

  /**
   * Handles subtyping on polymorphic endpoints
   */
  convert<T extends ModelType>(cls: Class<T>, o: T) {
    return BindUtil.bindSchema(cls, o);
  }

  /**
   * Handles any pre-retrieval activities needed
   */
  postLoad<T extends ModelType>(cls: Class<T>, o: T): T;
  postLoad<T extends ModelType>(cls: Class<T>, o: Partial<T>, view: string): Partial<T>;
  postLoad<T extends ModelType>(cls: Class<T>, o: T) {
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
  suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    return this.source.suggest(cls, field, prefix, query);
  }

  /**
   * Facet a given class on a specific field, limited by an optional query
   * @param cls The model class to facet on
   * @param field The field to facet on
   * @param query Additional query filtering
   */
  facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    return this.source.facet(cls, field, query);
  }

  /**
   * Suggest a set of entities (allows for duplicates with as long as they have different ids)
   * @param cls The model class to suggest against
   * @param field The field to suggest against
   * @param prefix The field prefix to search on
   * @param query Additional query filtering
   */
  async suggestEntities<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const results = await this.source.suggestEntities(cls, field, prefix, query);
    return results.map(x => this.postLoad(cls, x));
  }

  /**
   Executes a raw query against the model space
   * @param cls The model class
   * @param query The query to execute
   */
  async query<T extends ModelType, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    this.prepareQuery(cls, query);

    const res = await this.source.query<T, U>(cls, query);
    return res.map(o => this.postLoad(cls, o as unknown as T) as unknown as U);
  }

  /**
   * Executes a query string using the query language
   * @param cls The model class
   * @param query The query string to execute
   */
  async getAllByQueryString<T extends ModelType>(cls: Class<T>, query: PageableModelQueryStringQuery<T>) {
    const where = QueryLanguageParser.parseToQuery(query.query);
    const final = { where, ...query };
    return this.getAllByQuery(cls, final);
  }

  /**
   * Retrieves all instances of cls that match query
   * @param cls The model class
   * @param query The query to search against
   */
  async getAllByQuery<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    const config = ModelRegistry.get(cls) as ModelOptions<T>;
    // if (!query.sort && config.defaultSort) {
    //   query.sort = config.defaultSort;
    // }
    const res = await this.source.getAllByQuery(cls, query);
    const ret = await Promise.all(res.map(o => this.postLoad(cls, o)));
    return ret;
  }

  /**
   * Find the count of matching documents by query.
   * @param cls The model class
   * @param query The query to count for
   */
  getCountByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    return this.source.getCountByQuery(cls, query);
  }

  /**
   * Find one by query, fail if not found
   * @param cls The model class
   * @param query The query to search for
   * @param failOnMany Should the query fail on more than one result found
   */
  async getByQuery<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T> = {}, failOnMany: boolean = true) {
    this.prepareQuery(cls, query);

    const res = await this.source.getByQuery(cls, query, failOnMany);
    return this.postLoad(cls, res);
  }

  /**
   * Delete all by query
   * @param cls The model class
   * @param query Query to search for deletable elements
   */
  deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.prepareQuery(cls, query);

    return this.source.deleteByQuery(cls, query);
  }

  /**
   * Update/replace all with partial data, by query
   * @param cls The model class
   * @param query The query to search for
   * @param data The partial data
   */
  updateAllByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {
    this.prepareQuery(cls, query);

    return this.source.updateAllByQuery(cls, query, data);
  }

  /**
   * Partial update, by query
   * @param cls The model class
   * @param query The query to search for
   * @param o The partial data
   */
  async updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, o: Partial<T>) {
    // Do not do a standard pre-persist, because we don't know what we would be validating
    // await this.prePersistPartial(cls, o);

    this.prepareQuery(cls, query);

    const res = await this.source.updatePartialByQuery(cls, query, o);

    return this.postLoad(cls, res);
  }

  /**
   * Partial update by view and by query
   * @param cls The model class
   * @param o The partial object
   * @param view The view to enforce
   * @param query The query to find against
   */
  async updatePartialViewByQuery<T extends ModelType>(cls: Class<T>, o: Partial<T>, view: string, query: ModelQuery<T>) {
    this.prepareQuery(cls, query);

    // o = await this.prePersist(cls, o, view);
    const partial = BindUtil.bindSchemaToObject(cls, {} as T, o, view);
    const res = await this.source.updatePartialByQuery(cls, query, partial);

    return this.postLoad(cls, res);
  }
}