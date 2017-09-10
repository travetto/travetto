import { Class } from '@encore2/registry';
import { BindUtil, SchemaRegistry, SchemaValidator } from '@encore2/schema';
import { Injectable } from '@encore2/di';
import { ModelOptions } from './types';
import { ModelCore, Query, QueryOptions, BulkState, ModelId } from '../model';
import { ModelSource } from './source';
import { ModelRegistry } from './registry';

import * as _ from 'lodash';

function getClass<T>(o: T) {
  return o.constructor as Class<T>;
}

@Injectable({ target: ModelService })
export class ModelService extends ModelSource {

  constructor(private source: ModelSource) {
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
    let config = ModelRegistry.get(cls);

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

  async prePersist<T extends ModelCore>(o: T): Promise<T>;
  async prePersist<T extends ModelCore>(o: Partial<T>, view: string): Promise<Partial<T>>;
  async prePersist<T extends ModelCore>(o: Partial<T> | T, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let res = await SchemaValidator.validate(o.prePersist ? o.prePersist() as T : o, view);
    res = await this.source.prePersist(res);
    return res as T;
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T): T;
  postLoad<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string): Partial<T>;
  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    o = this.source.postLoad(cls, o) as T;
    o = this.convert(cls, o);

    o = o.postLoad ? o.postLoad() : o;
    return o;
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}) {
    const config = ModelRegistry.get(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await this.source.getAllByQuery(cls, query, options);
    return res.map(o => this.postLoad(cls, o));
  }

  getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}) {
    return this.source.getCountByQuery(cls, query);
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: Query, options: QueryOptions = {}, failOnMany: boolean = true) {
    let res = await this.source.getByQuery(cls, query, options, failOnMany);
    return this.postLoad(cls, res);
  }

  getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query, options: QueryOptions = {}) {
    return this.source.getIdsByQuery(cls, query, options);
  }

  async saveOrUpdate<T extends ModelCore>(cls: Class<T>, o: T, query: Query) {
    let res = await this.getAllByQuery(getClass(o), query, { limit: 2 });
    if (res.length === 1) {
      o = _.merge(res[0], o);
      return await this.update(cls, o);
    } else if (res.length === 0) {
      return await this.save(cls, o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string) {
    let res = await this.source.getById(cls, id);
    return this.postLoad(cls, res);
  }

  deleteById<T extends ModelCore>(cls: Class<T>, id: string) {
    return this.source.deleteById(cls, id);
  }

  deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}) {
    return this.source.deleteByQuery(cls, query);
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T) {
    o = await this.prePersist(o);
    let res = await this.source.save(cls, o);
    return this.postLoad(cls, res);
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]) {
    objs = await Promise.all(objs.map(o => this.prePersist(o)));
    let res = await this.source.saveAll(cls, objs);
    return res.map(x => this.postLoad(cls, x));
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T) {
    o = await this.prePersist(o);
    let res = await this.source.update(cls, o);
    return this.postLoad(cls, res);
  }

  updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query, data: Partial<T>) {
    return this.source.updateAllByQuery(cls, query, data);
  }

  updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>) {
    return this.source.updatePartial(cls, model);
  }

  updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: Query, body: Partial<T>) {
    return this.source.updatePartialByQuery(cls, query, body);
  }

  async updatePartialView<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string) {
    o = await this.prePersist(o, view);
    let partial = BindUtil.bindSchema(cls, {}, o, view);
    let res = await this.updatePartial(cls, partial);
    return this.postLoad(cls, res);
  }

  async updatePartialViewByQuery<T extends ModelCore>(cls: Class<T>, o: Partial<T>, view: string, query: Query) {
    o = await this.prePersist(o, view);
    let partial = BindUtil.bindSchema(cls, {}, o, view);
    let res = await this.updatePartialByQuery(cls, query, partial);
    return res;
  }

  bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>) {
    return this.source.bulkProcess(cls, state);
  }
}