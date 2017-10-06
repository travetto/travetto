import * as es from 'elasticsearch';
import * as flat from 'flat';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import { ModelSource, IndexConfig, Query, QueryOptions, BulkState, BulkResponse, ModelRegistry, ModelCore, isSubQuery } from '@travetto/model';
import { Injectable } from '@travetto/di';
import { ModelElasticsearchConfig } from './config';
import { Class } from '@travetto/registry';

@Injectable({ target: ModelSource })
export class ModelElasticsearchSource extends ModelSource {

  private client: es.Client;
  private indices: { [key: string]: IndexConfig[] } = {};

  constructor(private config: ModelElasticsearchConfig) {
    super();
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    if ((o as any)._id) {
      o.id = (o as any)._id;
      delete (o as any)._id;

      if ('_type' in o) {
        o.type = (o as any)['_type'];
        delete (o as any)['_type'];
      }
    }
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    if (o.id) {
      (o as any)._id = o.id;
      delete o.id;
      if (o.type) {
        (o as any)._type = o.type;
        delete o.type;
      }
    }
    return o;
  }

  async postConstruct() {
    await this.init();
  }

  async init() {
    this.client = await new es.Client(this.config);
  }

  getIdentity<T extends ModelCore>(cls: Class<T>): { type: string, index: string } {
    let conf = ModelRegistry.get(cls);
    let ret: { [key: string]: string } = {
      index: conf.collection || cls.name,
    };
    ret.type = conf.discriminator || ret.index;
    return ret as { type: string, index: string };
  }

  async resetDatabase() {
    await this.client.indices.delete({
      index: ''
    });
    await this.init();
  }


  transformQuery<T>(cls: Class<T>, query: Query) {
    let conf = ModelRegistry.get(cls);
    let res = {
      ...this.getIdentity(cls),
      body: {}
    }
    return res;
  }

  transformSearchQuery<T>(cls: Class<T>, query: Query, options: QueryOptions = {}) {
    let conf = ModelRegistry.get(cls);
    let res: es.SearchParams = this.transformQuery(cls, query);

    let sort = options.sort || conf.defaultSort;

    if (sort) {
      if (Array.isArray(sort) || typeof sort === 'string') {
        res.sort = sort;
      } else {
        res.sort = Object.entries(sort).map(x =>
          `${x[0]}:${x[1] > 0 ? 'asc' : 'desc'}`
        );
      }
    }

    if (options.offset) {
      res.from = options.offset;
    }

    if (options.limit) {
      res.size = options.limit;
    }

    return res;
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query) {
    let objs = await this.client.search<T>({
      _sourceInclude: ['_id'],
      ...this.transformSearchQuery(cls, query)
    })
    return objs.hits.hits.map(x => this.postLoad(cls, x._source));
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}): Promise<T[]> {
    let results = await this.client.search<T>(
      this.transformSearchQuery(cls, query, options),
    )
    let res = results.hits.hits.map(r => this.postLoad(cls, r._source));
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}): Promise<number> {
    let results = await this.client.search({
      ...this.transformSearchQuery(cls, query),
      size: 0
    })
    return results.hits.total;
  }

  async getByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, options: QueryOptions = {}, failOnMany = true): Promise<T> {
    let res = await this.getAllByQuery(cls, query, {
      limit: 200,
      ...options
    });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    return await this.getByQuery(cls, {
      _id: id
    });
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    let res = await this.client.delete({
      ...this.getIdentity(cls),
      id
    })
    return res.found ? 1 : 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}): Promise<number> {
    let res = await this.client.deleteByQuery({
      ...this.transformQuery(cls, query)
    })
    return res.deleted || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    delete o.id;

    let id = uuid.v4();
    let res = await this.client.create({
      ...this.getIdentity(cls),
      id,
      body: o
    })
    o.id = id;
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]): Promise<T[]> {
    for (let x of objs) {
      (x as any)._id = uuid.v4();
      delete x.id;
    }

    let res = await this.client.bulk({
      index: this.getIdentity(cls).index,
      body: objs.map(x => [
        { _type: this.getIdentity(x.constructor as Class<T>).type, _id: (x as any)._id },
        x
      ]),
    });

    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    this.prePersist(cls, o);
    await this.client.update({
      ...this.getIdentity(cls),
      id: o.id!,
      body: o
    });
    this.postLoad(cls, o);
    return o;
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    let update = this.client.update({
      method: '',
      ...this.getIdentity(cls),
      id: data.id,
      body: { doc: data }
    });
    return this.getById(cls, data.id);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: Query, data: Partial<T>): Promise<T> {

    let final: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      final = { $set: flat(final) };
    }

    let res = await col.findOneAndUpdate(query, final, Object.assign({ returnOriginal: false }, {}));
    if (!res.value) {
      throw new Error('Object not found for updating');
    }
    let ret: T = res.value as T;
    this.postLoad(cls, ret);
    return ret;
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query = {}, data: Partial<T>) {
    let finalData: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      finalData = { $set: flat(data) };
    }

    let script = '';

    let res = await this.client.updateByQuery({
      ...this.getIdentity(cls),
      body: {
        query: this.transformSearchQuery(cls, query),
        script: {
          lang: 'painless',
          inline: script
        }
      }
    })

    return res.updated;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>) {
    let bulk = col.initializeUnorderedBulkOp({});
    let count = 0;

    (state.upsert || []).forEach(p => {
      count++;
      let id: any = state.getId(p);
      if (id.id === undefined || id.id !== p.id) {
        delete p.id;
      } else {
        id._id = (p as any)._id = new mongo.ObjectID(p.id);
      }

      bulk.find(id).upsert().updateOne({
        $set: p
      });
    });

    (state.delete || []).forEach(p => {
      count++;
      bulk.find(state.getId(p)).removeOne();
    });

    let out: BulkResponse = {
      count: {
        delete: 0,
        update: 0,
        insert: 0
      }
    };

    if (count > 0) {
      let res = await bulk.execute({});
      let updatedCount = 0;

      if (out.count) {
        out.count.delete = res.nRemoved;
        out.count.update = updatedCount;
        out.count.update -= (out.count.insert || 0);
      }

      if (res.hasWriteErrors()) {
        out.error = res.getWriteErrors();
      }
    }

    return out;
  }
}