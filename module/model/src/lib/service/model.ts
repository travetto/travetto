import * as mongo from 'mongodb';
import { ModelCore } from '../model';
import { ModelCls, models, DEFAULT_VIEW } from './registry';
import { MongoService, QueryOptions } from '@encore/mongo';
import { Validator } from './validator';
import { bindData, convert, getCls } from '../util';
import { ObjectUtil } from '@encore/util';

async function prePersist<T extends ModelCore>(o: T, view: string = DEFAULT_VIEW) {
  return await Validator.validate(o.preSave ? o.preSave() : o, view);
}

function onRetrieve<T extends ModelCore>(cls: ModelCls<T>, o: T): T {
  o = convert(cls, o);
  return o.postLoad ? o.postLoad() : o;
}

export class ModelService {

  static async collection<T extends ModelCore>(cls: ModelCls<T>) {
    return await MongoService.collection(cls);
  }

  static async getByQuery<T extends ModelCore>(cls: ModelCls<T>, query: Object = {}, options: QueryOptions = {}): Promise<T[]> {
    const config = models[cls.name];
    if (!options.sort && config.defaultSort) {
      options.sort = config.defaultSort;
    }
    let res = await MongoService.getByQuery<T>(cls, query, options);
    return res.map(o => onRetrieve(cls, o));
  }

  static async getCountByQuery<T extends ModelCore>(cls: ModelCls<T>, query: Object = {}, options: QueryOptions = {}): Promise<{ count: number }> {
    let res = await MongoService.getCountByQuery(cls, query, options);
    return res;
  }

  static async findOne<T extends ModelCore>(cls: ModelCls<T>, query: Object, options: QueryOptions = {}, failOnMany: boolean = true): Promise<T> {
    let res = await MongoService.findOne<T>(cls, query, options, failOnMany);
    return onRetrieve(cls, res);
  }

  static async createOrUpdate<T extends ModelCore>(o: T, query: Object): Promise<T> {
    let res = await ModelService.getByQuery(getCls(o), query);
    if (res.length === 1) {
      o = ObjectUtil.merge(res[0], o);
      return await ModelService.update(o);
    } else if (res.length === 0) {
      return await ModelService.save(o);
    }
    throw new Error(`Too many already exist: ${res.length}`);
  }

  static async getById<T extends ModelCore>(cls: ModelCls<T>, id: string): Promise<T> {
    let res = await MongoService.getById<T>(cls, id);
    return onRetrieve(cls, res);
  }

  static rewriteError<T extends ModelCore>(cls: ModelCls<T>, e: any) {
    if (e.code === 11000) { // Handle duplicate errors
      e = new Error('Duplicate entry already exists');
    }

    return e;
  }

  static async deleteById<T extends ModelCore>(cls: ModelCls<T>, id: string): Promise<number> {
    try {
      return await MongoService.deleteById(cls, id);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async delete<T extends ModelCore>(o: T): Promise<number> {
    return await ModelService.deleteById(getCls(o), o._id);
  }

  static async deleteByQuery<T extends ModelCore>(cls: ModelCls<T>, query: Object & { _id?: any } = {}): Promise<number> {
    return await MongoService.deleteByQuery(cls, query);
  }

  static async save<T extends ModelCore>(o: T): Promise<T> {
    let cls = getCls(o);
    try {
      o = await prePersist(o);
      return await MongoService.save<T>(cls, o);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async saveAll<T extends ModelCore>(objs: T[]): Promise<T[]> {
    let cls = getCls(objs[0]);
    try {
      objs = await Validator.validateAll(objs.map(o => o.preSave ? o.preSave() : o));
      return await MongoService.saveAll<T>(cls, objs);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async update<T extends ModelCore>(o: T): Promise<T> {
    let cls = getCls(o);
    try {
      o = await prePersist(o);
      return await MongoService.update<T>(cls, o);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async updateView<T extends ModelCore>(o: T, view: string): Promise<T> {
    let cls = getCls(o);
    try {
      o = await prePersist(o, view);
      let partial = bindData(cls, {}, o, view);
      return await MongoService.partialUpdate<T>(cls, o._id, partial);
    } catch (e) {
      throw ModelService.rewriteError(cls, e);
    }
  }

  static async bulkProcess<T extends ModelCore>(named: ModelCls<T>, state: { upsert?: T[], delete?: T[] }) {
    let keys = models[named.name].primaryUnique || ['_id'];

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