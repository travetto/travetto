import { Class } from '@travetto/registry';
import { BindUtil, SchemaRegistry, SchemaValidator } from '@travetto/schema';
import { QueryVerifierService } from './query';
import { Injectable } from '@travetto/di';
import { ModelOptions } from './types';
import { ModelCore, Query, QueryOptions, BulkState, ModelQuery, PageableModelQuery, SortClause } from '../model';
import { ModelSource } from './source';
import { ModelRegistry } from './registry';

import * as _ from 'lodash';

function getClass<T>(o: T) {
  return o.constructor as Class<T>;
}

@Injectable({ target: ModelService })
export class ModelService extends ModelSource {

  constructor(private source: ModelSource, private queryService: QueryVerifierService) {
    super();
  }

  postConstruct() {
    // Cannot block on registry since this is an injectable (circular dep)
    //   Call but ignore return
    this.init();
  }

  async init() {
    await ModelRegistry.init();
    if (this.source.onChange) {
      ModelRegistry.on(this.source.onChange.bind(this.source));
    }
  }

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

  async prePersist<T extends ModelCore>(cls: Class<T>, o: T): Promise<T>;
  async prePersist<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string): Promise<Partial<T>>;
  async prePersist<T extends ModelCore>(cls: Class<T>, o: Partial<T> | T, view: string = SchemaRegistry.DEFAULT_VIEW) {
    if (o.prePersist) {
      o.prePersist();
    }
    let res = await SchemaValidator.validate(o, view);
    res = await this.source.prePersist(cls, res);
    return res as T;
  }

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

  query<U, T extends ModelCore = U>(cls: Class<T>, query: Query<T>) {
    this.queryService.verify(cls, query);

    return this.source.query<T, U>(cls, query);
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}) {
    this.queryService.verify(cls, query);

    const config = ModelRegistry.get(cls);
    if (!query.sort && config.defaultSort) {
      query.sort = [config.defaultSort as SortClause<T>];
    }
    const res = await this.source.getAllByQuery(cls, query);
    return res.map(o => this.postLoad(cls, o));
  }

  getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.queryService.verify(cls, query);

    return this.source.getCountByQuery(cls, query);
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}, failOnMany: boolean = true) {
    this.queryService.verify(cls, query);

    const res = await this.source.getByQuery(cls, query, failOnMany);
    return this.postLoad(cls, res);
  }

  async saveOrUpdate<T extends ModelCore>(cls: Class<T>, o: T, query: ModelQuery<T>) {
    this.queryService.verify(cls, query);

    const res = await this.getAllByQuery(getClass(o), { ...query, limit: 2 });
    if (res.length === 1) {
      o = _.merge(res[0], o);
      return await this.update(cls, o);
    } else if (res.length === 0) {
      return await this.save(cls, o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string) {
    const res = await this.source.getById(cls, id);
    return this.postLoad(cls, res);
  }

  deleteById<T extends ModelCore>(cls: Class<T>, id: string) {
    return this.source.deleteById(cls, id);
  }

  deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}) {
    this.queryService.verify(cls, query);

    return this.source.deleteByQuery(cls, query);
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T) {
    o = await this.prePersist(cls, o);
    const res = await this.source.save(cls, o);
    return this.postLoad(cls, res);
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]) {
    objs = await Promise.all(objs.map(o => this.prePersist(cls, o)));
    const res = await this.source.saveAll(cls, objs);
    return res.map(x => this.postLoad(cls, x));
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T) {
    o = await this.prePersist(cls, o);
    const res = await this.source.update(cls, o);
    return this.postLoad(cls, res);
  }

  updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>) {
    this.queryService.verify(cls, query);

    return this.source.updateAllByQuery(cls, query, data);
  }

  updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>) {
    return this.source.updatePartial(cls, model);
  }

  updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, body: Partial<T>) {
    this.queryService.verify(cls, query);

    return this.source.updatePartialByQuery(cls, query, body);
  }

  async updatePartialView<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string) {
    o = await this.prePersist(cls, o, view);
    const partial = BindUtil.bindSchema(cls, {}, o, view);
    const res = await this.updatePartial(cls, partial);
    return this.postLoad(cls, res);
  }

  async updatePartialViewByQuery<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string, query: ModelQuery<T>) {
    this.queryService.verify(cls, query);

    o = await this.prePersist(cls, o, view);
    const partial = BindUtil.bindSchema(cls, {}, o, view);
    const res = await this.updatePartialByQuery(cls, query, partial);
    return res;
  }

  bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>) {
    return this.source.bulkProcess(cls, state);
  }
}