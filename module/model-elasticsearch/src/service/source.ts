import * as es from 'elasticsearch';

import {
  ModelSource, IndexConfig, Query,
  QueryOptions, BulkState, BulkResponse,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  WhereClause,
  SelectClause,
  SortClause,
  ModelQuery
} from '@travetto/model';
import { Injectable } from '@travetto/di';
import { ModelElasticsearchConfig } from './config';
import { Class } from '@travetto/registry';
import { BaseError, isPlainObject, deepAssign } from '@travetto/base';

function has$And(o: any): o is ({ $and: WhereClause<any>[]; }) {
  return '$and' in o;
}

function has$Or(o: any): o is ({ $or: WhereClause<any>[]; }) {
  return '$or' in o;
}

function has$Not(o: any): o is ({ $not: WhereClause<any>; }) {
  return '$not' in o;
}

function hasId<T>(o: T): o is (T & { id: string | string[] | { $in: string[] } }) {
  return 'id' in o;
}

function has$In(o: any): o is { $in: any[] } {
  return '$in' in o && Array.isArray(o.$in);
}

export function extractWhereClause<T>(o: WhereClause<T>): { [key: string]: any } {
  if (has$And(o)) {
    return { bool: { must: o.$and.map(x => extractWhereClause<T>(x)) } };
  } else if (has$Or(o)) {
    return { bool: { should: o.$or.map(x => extractWhereClause<T>(x)), minimum_should_match: 1 } };
  } else if (has$Not(o)) {
    return { bool: { must_not: extractWhereClause<T>(o.$not) } };
  } else {
    return extractSimple(o);
  }
}

export function extractSimple<T>(o: T, path: string = ''): { [key: string]: any } {
  const out: { [key: string]: any } = {};
  const sub = o as { [key: string]: any };
  const keys = Object.keys(sub);
  for (const key of keys) {
    const subpath = `${path}${key}`;
    if (isPlainObject(sub[key]) && !Object.keys(sub[key])[0].startsWith('$')) {
      Object.assign(out, extractSimple(sub[key], `${subpath}.`));
    } else {
      out[subpath] = sub[key];
    }
  }
  return out;
}

export class ModelElasticsearchSource extends ModelSource {

  private client: es.Client;
  private indices: { [key: string]: IndexConfig<any>[] } = {};

  constructor(private config: ModelElasticsearchConfig) {
    super();
  }

  transformQuery<T>(cls: Class<T>, query: Query<T>) {
    const conf = ModelRegistry.get(cls);
    return {
      ...this.getIdentity(cls),
      body: {}
    };
  }

  transformSearchQuery<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}) {
    const conf = ModelRegistry.get(cls);
    const res: es.SearchParams = {
      body: this.transformQuery(cls, query)
    }

    const sort = options.sort || conf.defaultSort;

    if (sort) {
      res.sort = sort.map(x => {
        const o = extractSimple(x);
        const k = Object.keys(o)[0];
        const v = o[k] as (boolean | -1 | 1);
        if (v === 1 || v === true) {
          return k;
        } else {
          return `-${k}`;
        }
      });
    }

    if (options.offset) {
      res.from = options.offset;
    }

    if (options.limit) {
      res.size = options.limit;
    }

    return res;
  }

  getIdentity<T extends ModelCore>(cls: Class<T>): { type: string, index: string } {
    const conf = ModelRegistry.get(cls);
    return {
      index: conf.collection || cls.name,
      type: conf.discriminator || conf.collection || cls.name
    };
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const projected = extractWhereClause(query.where || {});

    let cursor = col.find(projected);
    if (query.select) {
      cursor.project(Object.keys(query.select)[0].startsWith('$') ? query.select : extractSimple(query.select));
    }

    if (query.sort) {
      cursor = cursor.sort(query.sort.map(x => extractSimple(x)));
    }

    cursor = cursor.limit(Math.trunc(query.limit || 200) || 200);

    if (query.offset) {
      cursor = cursor.skip(Math.trunc(query.offset) || 0);
    }

    const col = await this.client.search(projected);

    const out: U[] = [];
    for (const r of col.hits.hits) {
      const rd = this.postLoad<U>(undefined as any, r._source as any);
      out.push(rd);
    }
    return out;
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    if ((o as any)._id) {
      o.id = (o as any)._id as string;
      delete (o as any)._id;
    }
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    if (o.id) {
      (o as any)._id = o.id as string;
      delete o.id;
    }
    return o;
  }

  async postConstruct() {
    await this.init();
  }

  async init() {
    this.client = new es.Client(deepAssign({}, this.config));
    await this.client.cluster.health({});

    // PreCreate indexes
  }

  translateQueryIds<T extends ModelCore, U extends Query<T>>(query: U) {
    const where = (query.where || {});
    if (hasId(where)) {
      const val = where.id;
      delete where.id;
      if (Array.isArray(val) || typeof val === 'string') {
        (where as any)._id = val;
      } else if (has$In(val)) {
        const res: { $in: string[] } = val;
        (where as any)._id = { $in: res.$in };
      }
    }
    return query;
  }

  async resetDatabase() {
    await this.client.indices.delete({
      index: `${this.config.namespace}_*`
    });
    await this.init();
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query<T>) {
    const objs = await this.client.search<T>({
      _sourceInclude: ['_id'],
      ...this.transformSearchQuery(cls, query)
    })
    return objs.hits.hits.map(x => this.postLoad(cls, x._source));
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    const results = await this.client.search<T>(
      this.transformSearchQuery(cls, query),
    )
    const res = results.hits.hits.map(r => this.postLoad(cls, r._source));
    return res;
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const results = await this.client.search({
      ...this.transformSearchQuery(cls, query),
      size: 0
    })
    return results.hits.total;
  }
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 200, ...query });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    const query: PageableModelQuery<ModelCore> = {
      where: {
        id
      }
    }
    return await this.getByQuery<T>(cls, query as PageableModelQuery<T>);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const res = await this.client.delete({
      ...this.getIdentity(cls),
      id
    })
    return res.found ? 1 : 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const res = await this.client.deleteByQuery({
      ...this.transformQuery(cls, query)
    })
    return res.deleted || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    delete o.id;

    const res = await this.client.create({
      ...this.getIdentity(cls),
      body: o
    })
    o.id = res._id;
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]): Promise<T[]> {
    for (const x of objs) {
      delete x.id;
    }

    const res = await this.client.bulk({
      index: this.getIdentity(cls).index,
      body: objs.map(x => [
        { _type: this.getIdentity(x.constructor as Class<T>).type, _id: (x as any)._id }, // TODO: Figure out?
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
    const id = data.id;
    delete data.id;
    const update = this.client.update({
      method: 'update',
      ...this.getIdentity(cls),
      id,
      body: { doc: data }
    });
    return this.getById(cls, data.id);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    if (!data.id) {
      const item = await this.getByQuery(cls, query);
      data.id = item.id;
    }
    return await this.updatePartial(cls, data as any);
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, data: Partial<T>) {
    // TODO: finish
    let finalData: any = data;

    if (Object.keys(data)[0].charAt(0) !== '$') {
      finalData = { $set: extractSimple(data) };
    }

    const script = '';

    const res = await this.client.updateByQuery({
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
    /*const res = await this.client.bulk({
      body: flatten<object>([
        (state.delete || []).map(x => {
          return [
            { delete: this.getIdentity(cls), _id: x.id }
          ]
        }),
        (state.upsert || []).map(x => {
          return [
            { index: this.getIdentity(cls), _id: x.id },
            x
          ]
        })
      ])
    });

    const count = (state.delete || []).length + (state.upsert || []).length;

    const out: BulkResponse = {
      count: {
        delete: 0,
        update: 0,
        insert: 0
      }
    };

    if (count > 0) {
      const res = await bulk.execute({});
      const updatedCount = 0;

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
    */
    return null as any;
  }
}