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

@Injectable()
export class ModelService<T, ID = string> {

  constructor(private source: ModelSource<T, ID>) { }

  getConfig(cls: Class<T>) {
    return ModelRegistry.get(cls);
  }

  convert(cls: Class<T>, o: T): T {
    let config = this.getConfig(cls);

    let cons = cls;

    if (config && config.subtypes && !!(o as any)[this.source.getTypeField()]) {
      cons = config.subtypes[(o as any)[this.source.getTypeField()]];
    }

    return BindUtil.bindSchema(cons, new cons(), o);
  }

  async prePersist(o: Partial<T>, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let mc = o as ModelCore<T>;
    let res = await SchemaValidator.validate<T>(mc.preSave ? mc.preSave() : o, view);
    res = await this.source.prePersist(res);
    return res as T;
  }

  postLoad(cls: Class<T>, o: T): T {
    o = this.source.postLoad(o);
    o = this.convert(cls, o);

    let mc = o as ModelCore<T>;
    o = mc.postLoad ? mc.postLoad() : o;
    return o;
  }

  async getAllByQuery(cls: Class<T>, query: Query = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = this.getConfig(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await this.source.getAllByQuery(cls, query, options);
    return res.map(o => this.postLoad(cls, o));
  }

  async getCountByQuery(cls: Class<T>, query: Query = {}): Promise<number> {
    let res = await this.source.getCountByQuery(cls, query);
    return res;
  }

  async getByQuery(cls: Class<T>, query: Query, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await this.source.getByQuery(cls, query, options, failOnMany);
    return this.postLoad(cls, res);
  }

  async getIdsByQuery(cls: Class<T>, query: Query, options: QueryOptions = {}): Promise<ID[]> {
    let res = await this.source.getIdsByQuery(cls, query, options);
    return res;
  }

  async saveOrUpdate(o: T, query: Query): Promise<T> {
    let res = await this.getAllByQuery(getClass(o), query, { limit: 2 });
    if (res.length === 1) {
      o = _.merge(res[0], o);
      return await this.update(o);
    } else if (res.length === 0) {
      return await this.save(o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  async getById(cls: Class<T>, id: ID): Promise<T> {
    let res = await this.source.getById(cls, id);
    return this.postLoad(cls, res);
  }

  async deleteById(cls: Class<T>, id: ID): Promise<number> {
    return await this.source.deleteById(cls, id);
  }

  async deleteByQuery(cls: Class<T>, query: Query = {}): Promise<number> {
    return await this.source.deleteByQuery(cls, query);
  }

  async save(o: T): Promise<T> {
    let cls = getClass(o);
    o = await this.prePersist(o);
    let res = await this.source.save(cls, o);
    return this.postLoad(cls, res);
  }

  async saveAll(objs: T[]): Promise<T[]> {
    let cls = getClass(objs[0]);
    objs = await Promise.all(objs.map(o => this.prePersist(o)));
    let res = await this.source.saveAll(cls, objs);
    return res.map(x => this.postLoad(cls, x));
  }

  async update(o: T): Promise<T> {
    let cls = getClass(o);
    o = await this.prePersist(o);
    let res = await this.source.update(cls, o);
    return this.postLoad(cls, res);
  }

  async updateAll(objs: T[]): Promise<number> {
    let cls = getClass(objs[0]);
    objs = await Promise.all(objs.map(o => this.prePersist(o)));
    let res = await this.source.updateAll(cls, objs);
    return res;
  }

  async updatePartial(o: Partial<T>, view: string): Promise<T> {
    let cls = getClass(o) as Class<T>;
    o = await this.prePersist(o, view);
    let partial = BindUtil.bindSchema(cls, {}, o, view);
    let res = await this.source.updatePartial(cls, partial);
    return this.postLoad(cls, res);
  }

  async updatePartialByQuery(o: Partial<T>, view: string, query: Query): Promise<number> {
    let cls = getClass(o) as Class<T>;
    o = await this.prePersist(o, view);
    let partial = BindUtil.bindSchema(cls, {}, o, view);
    let res = await this.source.updatePartialByQuery(cls, partial, query);
    return res;
  }

  async bulkProcess(named: Class<T>, state: BulkState<T>) {
    return this.source.bulkProcess(named, state);
  }
}