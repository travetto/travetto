import { BindUtil, Class, SchemaRegistry, SchemaValidator } from '@encore/schema';
import { ModelOptions } from './types';
import { ModelCore, Query, QueryOptions } from '../model';
import { ModelSource } from './source';
import { ModelRegistry } from './registry';

export class ModelService {

  constructor(private source: ModelSource) { }

  getConfig<T>(cls: Class<T>) {
    return ModelRegistry.getOptions(cls);
  }

  convert<T>(cls: Class<T>, o: T): T {
    let config = this.getConfig(cls);

    let cons = cls;

    if (config && config.subtypes && !!(o as any)['_type']) {
      cons = config.subtypes[(o as any)['_type']];
    }

    return BindUtil.bindSchema(cons, new cons(), o);
  }

  async prePersist<T extends ModelCore>(o: T, view: string = SchemaRegistry.DEFAULT_VIEW) {
    return await SchemaValidator.validate(o.preSave ? o.preSave() : o, view);
  }

  onRetrieve<T extends ModelCore>(cls: Class<T>, o: T): T {
    o = this.convert(cls, o);
    return o.postLoad ? o.postLoad() : o;
  }

  rewriteError<T extends ModelCore>(cls: Class<T>, e: any) {
    if (e.code === 11000) { // Handle duplicate errors
      e = new Error('Duplicate entry already exists');
    }

    return e;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T> = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = this.getConfig(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await this.source.getByQuery<T>(cls, query, options);
    return res.map(o => onRetrieve(cls, o));
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Object = {}, options: QueryOptions = {}): Promise<{ count: number }> {
    let res = await this.source.getCountByQuery(cls, query, options);
    return res;
  }

  async findOne<T extends ModelCore>(cls: Class<T>, query: Object, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await this.source.findOne<T>(cls, query, options, failOnMany);
    return this.onRetrieve(cls, res);
  }

  async createOrUpdate<T extends ModelCore>(o: T, query: Object): Promise<T> {
    let res = await this.getByQuery(SchemaRegistry.getClass(o), query);
    if (res.length === 1) {
      o = ObjectUtil.merge(res[0], o);
      return await this.update(o);
    } else if (res.length === 0) {
      return await this.save(o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    let res = await this.source.getById<T>(cls, id);
    return this.onRetrieve(cls, res);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    try {
      return await this.source.deleteById(cls, id);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async delete<T extends ModelCore>(o: T): Promise<number> {
    return await this.deleteById(SchemaRegistry.getClass(o), o._id);
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Object & { _id?: any } = {}): Promise<number> {
    return await this.source.deleteByQuery(cls, query);
  }

  async save<T extends ModelCore>(o: T): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    try {
      o = await this.prePersist(o);
      let res = await this.source.save<T>(cls, o);
      return this.onRetrieve(cls, res);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async saveAll<T extends ModelCore>(objs: T[]): Promise<T[]> {
    let cls = SchemaRegistry.getClass(objs[0]);
    try {
      objs = await SchemaValidator.validateAll(objs.map(o => o.preSave ? o.preSave() : o));
      let res = await this.source.saveAll<T>(cls, objs);
      return res.map(x => onRetrieve(cls, x));
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async update<T extends ModelCore>(o: T): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    try {
      o = await this.prePersist(o);
      let res = await this.source.update(cls, o);
      return this.onRetrieve(cls, res);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async updateView<T extends ModelCore>(o: Partial<T>, view: string): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    try {
      o = await this.prePersist(o, view);
      let partial = BindUtil.bindSchema(cls, {}, o, view);
      let res = await this.source.partialUpdate<T>(partial);
      return this.onRetrieve(cls, res);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async bulkProcess<T extends ModelCore>(named: Class<T>, state: { upsert?: T[], delete?: T[] }) {
    let keys = this.getConfig(named).primaryUnique || ['_id'];

    try {
      return await this.source.bulkProcess(named, {
        upsert: state.upsert,
        delete: state.delete,
        getId: (p: any) => new Map(keys.map(x => [x, x === '_id' ? new mongo.ObjectID(p[x]) : p[x]] as [string, any]))
      });
    } catch (e) {
      throw this.rewriteError(named, e);
    }
  }
}