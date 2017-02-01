import * as mongo from 'mongodb';
import { ModelCore } from '../model';
import { MongoService, QueryOptions } from '@encore/mongo';
import { BindUtil, Cls, SchemaRegistry, SchemaValidator } from '@encore/schema';
import { ModelOptions } from './types';
import { ObjectUtil } from '@encore/util';

async function prePersist<T extends ModelCore>(o: T, view: string = SchemaRegistry.DEFAULT_VIEW) {
  return await SchemaValidator.validate(o.preSave ? o.preSave() : o, view);
}

function onRetrieve<T extends ModelCore>(cls: Cls<T>, o: T): T {
  o = convert(cls, o);
  return o.postLoad ? o.postLoad() : o;
}

function convert<T>(cls: Cls<T>, o: T): T {
  let config = ModelService.getConfig(cls);

  let cons = cls;

  if (config && config.subtypes && !!(o as any)['_type']) {
    cons = config.subtypes[(o as any)['_type']];
  }

  return BindUtil.bindSchema(cons, new cons(), o);
}

export class ModelService {

  static getConfig<T>(cls: Cls<T>) {
    return SchemaRegistry.getClassMetadata<any, ModelOptions>(cls, 'model');
  }

  static async collection<T extends ModelCore>(cls: Cls<T>) {
    return await MongoService.getCollection(cls);
  }

  static rewriteError<T extends ModelCore>(cls: Cls<T>, e: any) {
    if (e.code === 11000) { // Handle duplicate errors
      e = new Error('Duplicate entry already exists');
    }

    return e;
  }

  static async getByQuery<T extends ModelCore>(cls: Cls<T>, query: Object = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = ModelService.getConfig(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await MongoService.getByQuery<T>(cls, query, options);
    return res.map(o => onRetrieve(cls, o));
  }

  static async getCountByQuery<T extends ModelCore>(cls: Cls<T>, query: Object = {}, options: QueryOptions = {}): Promise<{ count: number }> {
    let res = await MongoService.getCountByQuery(cls, query, options);
    return res;
  }

  static async findOne<T extends ModelCore>(cls: Cls<T>, query: Object, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await MongoService.findOne<T>(cls, query, options, failOnMany);
    return onRetrieve(cls, res);
  }

  static async createOrUpdate<T extends ModelCore>(o: T, query: Object): Promise<T> {
    let res = await ModelService.getByQuery(SchemaRegistry.getCls(o), query);
    if (res.length === 1) {
      o = ObjectUtil.merge(res[0], o);
      return await ModelService.update(o);
    } else if (res.length === 0) {
      return await ModelService.save(o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  static async getById<T extends ModelCore>(cls: Cls<T>, id: string): Promise<T> {
    let res = await MongoService.getById<T>(cls, id);
    return onRetrieve(cls, res);
  }

  static async deleteById<T extends ModelCore>(cls: Cls<T>, id: string): Promise<number> {
    try {
      return await MongoService.deleteById(cls, id);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async delete<T extends ModelCore>(o: T): Promise<number> {
    return await ModelService.deleteById(SchemaRegistry.getCls(o), o._id);
  }

  static async deleteByQuery<T extends ModelCore>(cls: Cls<T>, query: Object & { _id?: any } = {}): Promise<number> {
    return await MongoService.deleteByQuery(cls, query);
  }

  static async save<T extends ModelCore>(o: T): Promise<T> {
    let cls = SchemaRegistry.getCls(o);
    try {
      o = await prePersist(o);
      let res = await MongoService.save<T>(cls, o);
      return onRetrieve(cls, res);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async saveAll<T extends ModelCore>(objs: T[]): Promise<T[]> {
    let cls = SchemaRegistry.getCls(objs[0]);
    try {
      objs = await SchemaValidator.validateAll(objs.map(o => o.preSave ? o.preSave() : o));
      let res = await MongoService.saveAll<T>(cls, objs);
      return res.map(x => onRetrieve(cls, x));
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async update<T extends ModelCore>(o: T): Promise<T> {
    let cls = SchemaRegistry.getCls(o);
    try {
      o = await prePersist(o);
      let res = await MongoService.update<T>(cls, o);
      return onRetrieve(cls, res);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async updateView<T extends ModelCore>(o: T, view: string): Promise<T> {
    let cls = SchemaRegistry.getCls(o);
    try {
      o = await prePersist(o, view);
      let partial = BindUtil.bindSchema(cls, {}, o, view);
      let res = await MongoService.partialUpdate<T>(cls, o._id, partial);
      return onRetrieve(cls, res);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async bulkProcess<T extends ModelCore>(named: Cls<T>, state: { upsert?: T[], delete?: T[] }) {
    let keys = ModelService.getConfig(named).primaryUnique || ['_id'];

    try {
      return await MongoService.bulkProcess(named, {
        upsert: state.upsert,
        delete: state.delete,
        getId: (p: any) => ObjectUtil.fromPairs(keys.map(x => [x, x === '_id' ? new mongo.ObjectID(p[x]) : p[x]] as [string, any]))
      });
    } catch (e) {
      throw ModelService.rewriteError(named, e);
    }
  }
}