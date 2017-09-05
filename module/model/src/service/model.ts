import { BindUtil, Class, SchemaRegistry, SchemaValidator } from '@encore/schema';
import { ModelOptions } from './types';
import { ModelCore } from '../model';
import { MongoService, QueryOptions } from '@encore/mongo';
import * as mongo from 'mongodb';

async function prePersist<T extends ModelCore>(o: T, view: string = SchemaRegistry.DEFAULT_VIEW) {
  return await SchemaValidator.validate(o.preSave ? o.preSave() : o, view);
}

function onRetrieve<T extends ModelCore>(cls: Class<T>, o: T): T {
  o = convert(cls, o);
  return o.postLoad ? o.postLoad() : o;
}

function convert<T>(cls: Class<T>, o: T): T {
  let config = this.getConfig(cls);

  let cons = cls;

  if (config && config.subtypes && !!(o as any)['_type']) {
    cons = config.subtypes[(o as any)['_type']];
  }

  return BindUtil.bindSchema(cons, new cons(), o);
}

export class ModelService {

  getConfig<T>(cls: Class<T>) {
    return SchemaRegistry.getClassMetadata<any, ModelOptions>(cls, 'model');
  }

  async collection<T extends ModelCore>(cls: Class<T>) {
    return await MongoService.getCollection(cls);
  }

  rewriteError<T extends ModelCore>(cls: Class<T>, e: any) {
    if (e.code === 11000) { // Handle duplicate errors
      e = new Error('Duplicate entry already exists');
    }

    return e;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: Object = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = this.getConfig(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await MongoService.getByQuery<T>(cls, query, options);
    return res.map(o => onRetrieve(cls, o));
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Object = {}, options: QueryOptions = {}): Promise<{ count: number }> {
    let res = await MongoService.getCountByQuery(cls, query, options);
    return res;
  }

  async findOne<T extends ModelCore>(cls: Class<T>, query: Object, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await MongoService.findOne<T>(cls, query, options, failOnMany);
    return onRetrieve(cls, res);
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
    let res = await MongoService.getById<T>(cls, id);
    return onRetrieve(cls, res);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    try {
      return await MongoService.deleteById(cls, id);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async delete<T extends ModelCore>(o: T): Promise<number> {
    return await this.deleteById(SchemaRegistry.getClass(o), o._id);
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Object & { _id?: any } = {}): Promise<number> {
    return await MongoService.deleteByQuery(cls, query);
  }

  async save<T extends ModelCore>(o: T): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    try {
      o = await prePersist(o);
      let res = await MongoService.save<T>(cls, o);
      return onRetrieve(cls, res);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async saveAll<T extends ModelCore>(objs: T[]): Promise<T[]> {
    let cls = SchemaRegistry.getClass(objs[0]);
    try {
      objs = await SchemaValidator.validateAll(objs.map(o => o.preSave ? o.preSave() : o));
      let res = await MongoService.saveAll<T>(cls, objs);
      return res.map(x => onRetrieve(cls, x));
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async update<T extends ModelCore>(o: T): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    try {
      o = await prePersist(o);
      let res = await MongoService.update<T>(cls, o);
      return onRetrieve(cls, res);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async updateView<T extends ModelCore>(o: T, view: string): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    try {
      o = await prePersist(o, view);
      let partial = BindUtil.bindSchema(cls, {}, o, view);
      let res = await MongoService.partialUpdate<T>(cls, o._id, partial);
      return onRetrieve(cls, res);
    } catch (e) {
      throw this.rewriteError(cls, e);
    }
  }

  async bulkProcess<T extends ModelCore>(named: Class<T>, state: { upsert?: T[], delete?: T[] }) {
    let keys = this.getConfig(named).primaryUnique || ['_id'];

    try {
      return await MongoService.bulkProcess(named, {
        upsert: state.upsert,
        delete: state.delete,
        getId: (p: any) => new Map(keys.map(x => [x, x === '_id' ? new mongo.ObjectID(p[x]) : p[x]] as [string, any]))
      });
    } catch (e) {
      throw this.rewriteError(named, e);
    }
  }
}