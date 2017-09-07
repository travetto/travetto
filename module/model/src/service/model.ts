import { BindUtil, Class, SchemaRegistry, SchemaValidator } from '@encore2/schema';
import { Injectable } from '@encore2/di';
import { ModelOptions } from './types';
import { ModelCore, Query, QueryOptions, BulkState, ModelId } from '../model';
import { ModelSource } from './source';
import { ModelRegistry } from './registry';
import * as _ from 'lodash';

@Injectable()
export class ModelService {

  constructor(private source: ModelSource) { }

  getConfig<T>(cls: Class<T>) {
    return ModelRegistry.getOptions(cls);
  }

  convert<T>(cls: Class<T>, o: T): T {
    let config = this.getConfig(cls);

    let cons = cls;

    if (config && config.subtypes && !!(o as any)[this.source.getTypeField()]) {
      cons = config.subtypes[(o as any)[this.source.getTypeField()]];
    }

    return BindUtil.bindSchema(cons, new cons(), o);
  }

  async prePersist<T>(o: T, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let mc = o as ModelCore;
    let res = await SchemaValidator.validate(mc.preSave ? mc.preSave() : o, view);
    res = await this.source.prePersist(res);
    return res as T;
  }

  postLoad<T>(cls: Class<T>, o: T): T {
    o = this.source.postLoad(o);
    o = this.convert(cls, o);

    let mc = o as ModelCore;
    o = mc.postLoad ? mc.postLoad() as T : o;
    return o;
  }

  async getAllByQuery<T>(cls: Class<T>, query: Query<T> = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = this.getConfig(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await this.source.getAllByQuery(cls, query, options);
    return res.map(o => this.postLoad(cls, o));
  }

  async getCountByQuery<T>(cls: Class<T>, query: Query<T> = {}): Promise<number> {
    let res = await this.source.getCountByQuery(cls, query);
    return res;
  }

  async getByQuery<T>(cls: Class<T>, query: Query<T>, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await this.source.getByQuery<T>(cls, query, options, failOnMany);
    return this.postLoad(cls, res);
  }

  async getIdsByQuery<T>(cls: Class<T>, query: Query<T>, options: QueryOptions = {}): Promise<ModelId> {
    let res = await this.source.getIdsByQuery<T>(cls, query, options);
    return res;
  }

  async saveOrUpdate<T>(o: T, query: Query<T>): Promise<T> {
    let res = await this.getAllByQuery(SchemaRegistry.getClass(o), query, { limit: 2 });
    if (res.length === 1) {
      o = _.merge(res[0], o);
      return await this.update(o);
    } else if (res.length === 0) {
      return await this.save(o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  async getById<T>(cls: Class<T>, id: ModelId): Promise<T> {
    let res = await this.source.getById<T>(cls, id);
    return this.postLoad(cls, res);
  }

  async deleteById<T>(cls: Class<T>, id: ModelId): Promise<number> {
    return await this.source.deleteById(cls, id);
  }

  async deleteByQuery<T>(cls: Class<T>, query: Query<T> = {}): Promise<number> {
    return await this.source.deleteByQuery(cls, query);
  }

  async save<T>(o: T): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    o = await this.prePersist(o);
    let res = await this.source.save<T>(cls, o);
    return this.postLoad(cls, res);
  }

  async saveAll<T>(objs: T[]): Promise<T[]> {
    let cls = SchemaRegistry.getClass(objs[0]);
    objs = await Promise.all(objs.map(o => this.prePersist(o)));
    let res = await this.source.saveAll<T>(cls, objs);
    return res.map(x => this.postLoad(cls, x));
  }

  async update<T>(o: T): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    o = await this.prePersist(o);
    let res = await this.source.update(cls, o);
    return this.postLoad(cls, res);
  }

  async updateAll<T>(objs: T[]): Promise<T[]> {
    let cls = SchemaRegistry.getClass(objs[0]);
    objs = await Promise.all(objs.map(o => this.prePersist(o)));
    let res = await this.source.updateAll<T>(cls, objs);
    return res.map(x => this.postLoad(cls, x));
  }

  async updatePartial<T>(o: Partial<T>, view: string): Promise<T> {
    let cls = SchemaRegistry.getClass(o) as Class<T>;
    o = await this.prePersist(o, view);
    let partial = BindUtil.bindSchema(cls, {}, o, view);
    let res = await this.source.updatePartial<T>(cls, partial);
    return this.postLoad(cls, res);
  }

  async updatePartialByQuery<T>(o: Partial<T>, view: string, query: Query<T>): Promise<number> {
    let cls = SchemaRegistry.getClass(o) as Class<T>;
    o = await this.prePersist(o, view);
    let partial = BindUtil.bindSchema(cls, {}, o, view);
    let res = await this.source.updatePartialByQuery(cls, partial, query);
    return res;
  }

  async bulkProcess<T>(named: Class<T>, state: BulkState<T>) {
    return this.source.bulkProcess(named, state);
  }
}