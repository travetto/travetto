import * as es from 'elasticsearch';

import {
  ModelSource, IndexConfig, Query,
  QueryOptions, BulkState, BulkResponse,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  SelectClause,
  ModelQuery
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { Util } from '@travetto/base';
import { SchemaChangeEvent } from '@travetto/schema';

import { ModelElasticsearchConfig } from './config';
import { extractWhereQuery } from './query-builder';
import { generateSourceSchema } from './schema';

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
    index?: ESBulkItemPayload,
    update?: ESBulkItemPayload,
    delete?: ESBulkItemPayload
  }[]
};

const hasId = <T>(o: T): o is (T & { id: string | string[] | { $in: string[] } }) => 'id' in o;
const has$In = (o: any): o is { $in: any[] } => '$in' in o && Array.isArray(o.$in);

export function extractSimple<T>(o: T, path: string = ''): { [key: string]: any } {
  const out: { [key: string]: any } = {};
  const sub = o as { [key: string]: any };
  const keys = Object.keys(sub);
  for (const key of keys) {
    const subpath = `${path}${key}`;
    if (Util.isPlainObject(sub[key]) && !Object.keys(sub[key])[0].startsWith('$')) {
      Object.assign(out, extractSimple(sub[key], `${subpath}.`));
    } else {
      out[subpath] = sub[key];
    }
  }
  return out;
}

export class ModelElasticsearchSource extends ModelSource {

  private indices: { [key: string]: IndexConfig<any>[] } = {};
  public client: es.Client;

  constructor(private config: ModelElasticsearchConfig) {
    super();
  }

  async createIndex(cls: Class<any>, alias = true) {
    const schema = generateSourceSchema(cls);
    const ident = this.getIdentity(cls);
    const index = `${ident.index}_${(Math.random() * 1000000).toFixed(0)}`;
    try {
      await this.client.indices.create({
        index,
        body: {
          mappings: {
            [ident.type]: schema
          }
        }
      });
      if (alias) {
        await this.client.indices.putAlias({ index, name: ident.index });
      }
      console.debug(`Index ${ident.index} created`);
    } catch (e) {
      console.debug(`Index ${ident.index} already created`);
    }
    return index;
  }

  async onSchemaChange(e: SchemaChangeEvent) {
    const removes = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'removing')
        .map(ev => [...v.path, ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    const typeChanges = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'changed')
        .map(ev => [...v.path, ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    const { index, type } = this.getIdentity(e.cls);

    if (removes.length || typeChanges.length) { // Removing and adding
      const next = await this.createIndex(e.cls, false);

      const aliases = await this.client.indices.getAlias({ index });
      const curr = Object.keys(aliases)[0];

      // Reindex
      await this.client.reindex({
        body: {
          source: { index: curr },
          dest: { index: next },
          script: {
            lang: 'painless',
            inline: removes.map(x => `ctx._source.remove("${x}");`).join(' ') // Removing
          }
        },
        waitForCompletion: true
      });

      await Promise.all(Object.keys(aliases)
        .map(x => this.client.indices.delete({ index: x })));

      await this.client.indices.putAlias({ index: next, name: index });
    } else { // Only update
      const schema = generateSourceSchema(e.cls);

      await this.client.indices.putMapping({
        index,
        type,
        body: schema
      });
    }
  }

  onChange<T extends ModelCore>(e: ChangeEvent<Class<T>>): void {
    console.debug('Model Changed', e);

    // Handle ADD/REMOVE
    if (e.prev && !e.curr) { // Removing
      this.client.indices.delete({
        index: `${this.config.namespace}_${e.prev.__id.toLowerCase()}`
      });
    } else if (e.curr && !e.prev) { // Adding
      const index = `${this.config.namespace}_${e.curr!.__id.toLowerCase()}`;
      this.client.indices.getAlias({ index })
        .then(async x => {
          const src = Object.keys(x)[0];
          await this.createIndex(e.curr!);
        });
    }
  }

  getSelect<T>(clause: SelectClause<T>) {
    const simp = extractSimple(clause);
    const include: string[] = [];
    const exclude: string[] = [];
    for (const k of Object.keys(simp)) {
      const nk = k === 'id' ? '_id' : k;
      const v: (1 | 0 | boolean) = simp[k];
      if (v === 0 || v === false) {
        exclude.push(nk);
      } else {
        include.push(nk);
      }
    }
    return [include, exclude];
  }

  getSearchObject<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}) {
    const conf = ModelRegistry.get(cls);

    query = this.translateQueryIds(query);

    const search: es.SearchParams = {
      ...this.getIdentity(cls),
      body: query.where ? { query: extractWhereQuery(query.where!, cls) } : {}
    };

    const sort = query.sort || conf.defaultSort;

    if (query.select) {
      const [inc, exc] = this.getSelect(query.select);
      if (inc.length) {
        search._sourceInclude = inc;
      }
      if (exc.length) {
        search._sourceExclude = exc;
      }
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
    const type = `${this.config.namespace}_${(conf.discriminator || conf.collection || cls.name).toLowerCase()}`;
    return { index: type, type };
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const req = this.getSearchObject(cls, query);
    const results = await await this.client.search<U>(req);

    const out: U[] = [];

    // determine if id
    const select = [req._sourceInclude as string[] || [], req._sourceExclude as string[] || []];
    const includeId = select[0].includes('_id') || (select[0].length === 0 && !select[1].includes('_id'));

    for (const r of results.hits.hits) {
      const obj = r._source;
      if (includeId) {
        (obj as any)._id = r._id;
      }
      out.push(obj);
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
    this.client = new es.Client(Util.deepAssign({}, this.config));
    await this.client.cluster.health({});

    // PreCreate indexes
    const create = ModelRegistry.getClasses().map(x => this.createIndex(x));
    await Promise.all(create);
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
    };
    return await this.getByQuery<T>(cls, query as PageableModelQuery<T>);
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const res = await this.client.delete({
      ...this.getIdentity(cls),
      id
    });
    return res.found ? 1 : 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const res = await this.client.deleteByQuery(this.getSearchObject(cls, query) as es.DeleteDocumentByQueryParams);
    return res.deleted || 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, removeId: boolean = true): Promise<T> {
    delete o.id;
    this.prePersist(cls, o);

    const res = await this.client.index({
      ...this.getIdentity(cls),
      refresh: 'wait_for',
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
    await this.client.update({
      ...this.getIdentity(cls),
      id: o.id!,
      refresh: 'wait_for',
      body: o
    });
    return o;
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    const id = data.id;
    delete data.id;
    const update = this.client.update({
      method: 'update',
      ...this.getIdentity(cls),
      id,
      refresh: 'wait_for',
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
      refresh: true,
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
        acc.push({ index: {} }, e);
        return acc;
      }, [] as any),
      ...(state.update || []).reduce((acc, e) => {
        acc.push({ update: { _id: e.id } }, { doc: e });
        return acc;
      }, [] as any)
    ];

    const res: EsBulkResponse = await this.client.bulk({
      index: conf.index,
      type: conf.type,
      body: payload,
      refresh: true
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
        (out.count as any)[k === 'index' ? 'insert' : k] += 1;
      }
    }

    return out as BulkResponse;
  }
}