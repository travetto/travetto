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

type ESBulkItemPayload = {
  _id: string;
  status: 201 | 400 | 409 | 404 | 200;
  result: 'created' | 'updated' | 'deleted' | 'not_found';
  error?: {
    type: string;
    reason: string;
  }
};

type EsBulkResponse = {
  errors: boolean;
  items: {
    index?: ESBulkItemPayload;
    update?: ESBulkItemPayload;
    delete?: ESBulkItemPayload;
  }[]
};

const has$And = (o: any): o is ({ $and: WhereClause<any>[]; }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[]; }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any>; }) => '$not' in o;
const hasId = <T>(o: T): o is (T & { id: string | string[] | { $in: string[] } }) => 'id' in o;
const has$In = (o: any): o is { $in: any[] } => '$in' in o && Array.isArray(o.$in);

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

  getSearchObject<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}) {
    const conf = ModelRegistry.get(cls);

    const search: es.SearchParams = {
      body: this.transformQuery(cls, query)
    }

    const sort = query.sort || conf.defaultSort;

    if (query.select) {
      const simp = extractSimple(query.select);
      const include: string[] = [];
      const exclude: string[] = [];
      for (const k of Object.keys(simp)) {
        const nk = k === '_id' ? 'id' : k;
        const v: (1 | 0 | boolean) = simp[k];
        if (v === 0 || v === false) {
          exclude.push(k);
        } else {
          include.push(k);
        }
      }
      search._sourceExclude = exclude;
      search._sourceInclude = include;
    }

    if (sort) {
      search.sort = sort.map(x => {
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

    if (query.offset) {
      search.from = query.offset;
    }

    if (query.limit) {
      search.size = query.limit;
    }

    return search;
  }

  getIdentity<T extends ModelCore>(cls: Class<T>): { type: string, index: string } {
    const conf = ModelRegistry.get(cls);
    const type = `${this.config.namespace}_${conf.discriminator || conf.collection || cls.name}`;
    return { index: type, type };
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const results = await await this.client.search<U>(this.getSearchObject(cls, query));

    const out: U[] = [];
    for (const r of results.hits.hits) {
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

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>) {
    const res = await this.client.search<ModelCore>(this.getSearchObject(cls, {
      select: {
        id: 1
      } as SelectClause<ModelCore>,
      ...query
    }));
    return res.hits.hits.map(x => x._source.id);
  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    return this.query(cls, query);
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const results = await this.client.search(this.getSearchObject(cls, {
      ...query,
      limit: 0
    }));
    return results.hits.total;
  }
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 2, ...query });
    if (!res || res.length < 1 || (failOnMany && res.length !== 1)) {
      throw new Error(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    const query: PageableModelQuery<ModelCore> = {
      where: { id }
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
    const res = await this.client.deleteByQuery(this.getSearchObject(cls, query) as es.DeleteDocumentByQueryParams);
    return res.deleted || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    delete o.id;
    this.prePersist(cls, o);

    const res = await this.client.create({
      ...this.getIdentity(cls),
      body: o
    });

    o.id = res._id;
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[]): Promise<T[]> {
    for (const x of objs) {
      delete x.id;
      this.prePersist(cls, x);
    }

    const res = await this.bulkProcess(cls, { insert: objs });
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
    const script = Object.keys(data).map(x => {
      return `ctx._source.${x} = ${JSON.stringify((data as any)[x])}`;
    }).join(';');

    const res = await this.client.updateByQuery({
      ...this.getIdentity(cls),
      body: {
        query: this.getSearchObject(cls, query).body,
        script: {
          lang: 'painless',
          inline: script
        }
      }
    });

    return res.updated;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>) {
    const conf = this.getIdentity(cls);

    const payload: es.BulkIndexDocumentsParams['body'] = [
      ...(state.delete || []).reduce((acc, e) => {
        acc.push({ ['delete']: { _id: e.id } });
        return acc;
      }, [] as any[]),
      ...(state.insert || []).reduce((acc, e) => {
        acc.push({ insert: {} }, e);
        return acc;
      }, [] as any),
      ...(state.update || []).reduce((acc, e) => {
        acc.push({ insert: { _id: e.id } }, { doc: e });
        return acc;
      }, [] as any)
    ]

    const res: EsBulkResponse = await this.client.bulk({
      index: conf.index,
      type: conf.type,
      body: payload
    });

    const out = {
      count: {
        delete: 0,
        insert: 0,
        update: 0,
        error: 0
      },
      error: [] as any[]
    };

    for (const item of res.items) {
      const k = Object.keys(item)[0];
      const v = (item as any)[k] as ESBulkItemPayload;
      if (v.error) {
        out.error.push(v.error);
        out.count.error += 1;
      } else {
        (out.count as any)[k] += 1;
      }
    }

    return out as BulkResponse;
  }
}