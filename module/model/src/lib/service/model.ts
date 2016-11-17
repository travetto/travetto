import * as mongo from "mongodb";
import { BaseModel } from '../model';
import { ModelCls, getModelConfig } from './registry';
import { MongoService, QueryOptions, BulkState } from '@encore/mongo';
import { Validator } from './validator';
import { getCls, convert } from '../util';
import { ObjectUtil } from '@encore/util';

export class ModelService {

  static async collection<T extends BaseModel>(cls: ModelCls<T>) {
    return await MongoService.collection(cls);
  }

  static async getByQuery<T extends BaseModel>(cls: ModelCls<T>, query: Object = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = getModelConfig(cls);
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await MongoService.getByQuery<T>(cls, query, options);
    return res.map(o => convert(cls, o));
  }

  static async getCountByQuery<T extends BaseModel>(cls: ModelCls<T>, query: Object = {}, options: QueryOptions = {}): Promise<{ count: number }> {
    let res = await MongoService.getCountByQuery(cls, query, options);
    return res;
  }

  static async findOne<T extends BaseModel>(cls: ModelCls<T>, query: Object, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await MongoService.findOne<T>(cls, query, options, failOnMany);
    return convert(cls, res);
  }

  static async createOrUpdate<T extends BaseModel>(o: T, query: Object): Promise<T> {
    let res = await ModelService.getByQuery(getCls(o), query);
    if (res.length == 1) {
      o = ObjectUtil.merge(res[0], o);
      return await ModelService.update(o);
    } else if (res.length == 0) {
      return await ModelService.save(o);
    }
    throw new Error(`Too many already exist: ${res.length}`)
  }

  static async getById<T extends BaseModel>(cls: ModelCls<T>, id: string): Promise<T> {
    let res = await MongoService.getById<T>(cls, id);
    return convert(cls, res);
  }

  static rewriteError<T extends BaseModel>(cls: ModelCls<T>, e: any) {
    if (e.code === 11000) { //Handle duplicate errors
      e = {
        message: "Duplicate entry already exists",
        statusCode: 501
      }
    }

    return e;
  }

  static async deleteById<T extends BaseModel>(cls: ModelCls<T>, id: string): Promise<number> {
    try {
      return await MongoService.deleteById(cls, id);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async delete<T extends BaseModel>(o: T): Promise<number> {
    return await ModelService.deleteById(getCls(o), o._id);
  }

  static async deleteByQuery<T extends BaseModel>(cls: ModelCls<T>, query: Object & { _id?: any } = {}): Promise<number> {
    return await MongoService.deleteByQuery(cls, query);
  }

  static async save<T extends BaseModel>(o: T): Promise<T> {
    let cls = getCls(o);
    try {
      o = await Validator.validate(o.preSave());
      return await MongoService.save<T>(cls, o);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async saveAll<T extends BaseModel>(objs: T[]): Promise<T[]> {
    let cls = getCls(objs[0]);
    try {
      objs = await Validator.validateAll(objs.map(o => o.preSave()));
      return await MongoService.saveAll<T>(cls, objs);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async update<T extends BaseModel>(o: T): Promise<T> {
    let cls = getCls(o);
    try {
      o = await Validator.validate(o.preSave())
      return await MongoService.update<T>(cls, o);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async bulkProcess<T extends BaseModel>(named: ModelCls<T>, state: { upsert?: T[], delete?: T[] }) {
    let keys = getModelConfig(named).primaryUnique || ['_id'];

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