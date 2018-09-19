import * as es from 'elasticsearch';

import {
  ModelSource, IndexConfig, Query,
  QueryOptions, BulkResponse, BulkOp,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  SelectClause,
  ModelQuery
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { Util, Env, BaseError } from '@travetto/base';
import { SchemaChangeEvent } from '@travetto/schema';

import { ModelElasticsearchConfig } from './config';
import { EsBulkResponse, EsIdentity, EsBulkError } from './types';
import { ElasticsearchUtil } from './util';

export class ModelElasticsearchSource extends ModelSource {

  private identities: Map<Class, EsIdentity> = new Map();
  private indices: { [key: string]: IndexConfig<any>[] } = {};
  private indexToClass: Map<string, Class> = new Map();
  public client: es.Client;

  constructor(private config: ModelElasticsearchConfig) {
    super();
  }

  getNamespacedIndex(idx: string) {
    if (this.config.namespace) {
      return `${this.config.namespace}_${idx}`;
    } else {
      return idx;
    }
  }

  getClassFromIndex(idx: string) {
    if (!this.indexToClass.has(idx)) {
      let type = idx;
      if (this.config.namespace) {
        type = idx.replace(`${this.config.namespace}_`, '');
      }
      const cls = ModelRegistry.getClasses().find(x => x.name.toLowerCase() === type)!;
      this.indexToClass.set(idx, cls);
    }
    return this.indexToClass.get(idx)!;
  }

  getIdentity<T extends ModelCore>(cls: Class<T>): EsIdentity {
    if (!this.identities.has(cls)) {
      const conf = ModelRegistry.get(cls);
      const type = this.getNamespacedIndex((conf.discriminator || conf.collection || cls.name).toLowerCase());
      this.identities.set(cls, { index: type, type });
    }
    return { ...this.identities.get(cls)! };
  }

  async createIndexIfMissing(cls: Class) {
    const ident = this.getIdentity(cls);
    try {
      await this.client.search({
        index: ident.index,
        type: ident.type
      });
    } catch (err) {
      await this.createIndex(cls);
    }
  }

  async createIndex(cls: Class, alias = true) {
    const schema = ElasticsearchUtil.generateSourceSchema(cls);
    const ident = this.getIdentity(cls); // Already namespaced
    const concreteIndex = `${ident.index}_${Date.now()}`;
    try {
      await this.client.indices.create({
        index: concreteIndex,
        body: {
          mappings: {
            [ident.type]: schema
          }
        }
      });
      if (alias) {
        await this.client.indices.putAlias({ index: concreteIndex, name: ident.index });
      }
      console.debug(`Index ${ident.index} created`);
    } catch (e) {
      console.debug(`Index ${ident.index} already created`);
    }
    return concreteIndex;
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
      const schema = ElasticsearchUtil.generateSourceSchema(e.cls);

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
        index: this.getNamespacedIndex(e.prev.__id.toLowerCase())
      });
    } else if (e.curr && !e.prev) { // Adding
      this.createIndexIfMissing(e.curr!);
    }
  }

  getSearchObject<T>(cls: Class<T>, query: Query<T>, options: QueryOptions<T> = {}) {
    const conf = ModelRegistry.get(cls);

    query = ElasticsearchUtil.translateQueryIds(query);

    const search: es.SearchParams = {
      ...this.getIdentity(cls),
      body: query.where ? { query: ElasticsearchUtil.extractWhereQuery(query.where!, cls) } : {}
    };

    const sort = query.sort || conf.defaultSort;

    if (query.select) {
      const [inc, exc] = ElasticsearchUtil.getSelect(query.select);
      if (inc.length) {
        search._sourceInclude = inc;
      }
      if (exc.length) {
        search._sourceExclude = exc;
      }
    }

    if (sort) {
      search.sort = sort.map(x => {
        const o = ElasticsearchUtil.extractSimple(x);
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

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const req = this.getSearchObject(cls, query);
    const results = await this.client.search<U>(req);

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

    // PreCreate indexes if missing
    if (!Env.prod) {
      const all = ModelRegistry.getClasses().map(x => this.createIndexIfMissing(x));
      await Promise.all(all);
    }
  }

  async resetDatabase() {
    await this.client.indices.delete({
      index: this.getNamespacedIndex('*')
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

  async getMultiQueryRaw<T extends ModelCore = ModelCore>(classes: Class<T>[], query: Query<T>) {
    const searchObj = this.getSearchObject(classes[0], query);
    searchObj.index = this.getIndices(classes);
    delete searchObj.type;
    return await this.client.search(searchObj);
  }

  getIndices<T extends ModelCore>(classes: Class<T>[]) {
    return classes.map(t => this.getIdentity(t).index).join(',');
  }

  async convertRawResponse<T extends ModelCore>(response: es.SearchResponse<T>) {
    const out: T[] = [];

    for (const item of response.hits.hits) {
      const index = item._type;
      const itemCls = this.getClassFromIndex(index);
      const obj: T = itemCls.from(item._source as T);
      obj.id = item._id;
      this.postLoad(itemCls, obj);
      if (obj.postLoad) {
        obj.postLoad();
      }
      obj.type = itemCls.name.toLowerCase();
      out.push(obj);
    }
    return out;
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
      throw new BaseError(`Invalid number of results for find by id: ${res ? res.length : res}`);
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

  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId: boolean = false): Promise<T> {
    if (!keepId) {
      delete o.id;
    }
    this.prePersist(cls, o);

    const res = await this.client.index({
      ...this.getIdentity(cls),
      refresh: 'wait_for',
      body: o
    });

    o.id = res._id;
    return o;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, objs: T[], keepId: boolean = false): Promise<T[]> {
    for (const x of objs) {
      if (!keepId) {
        delete x.id;
      }
      this.prePersist(cls, x);
    }

    const res = await this.bulkProcess(cls, objs.map(x => ({ upsert: x })));
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
    const update = await this.client.update({
      ...this.getIdentity(cls),
      id,
      refresh: 'wait_for',
      body: { doc: data }
    });
    return this.getById(cls, id);
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

  async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]) {
    const body: es.BulkIndexDocumentsParams['body'] = operations.reduce((acc, op) => {
      if (op.delete) {
        acc.push({ ['delete']: { _id: op.delete.id } });
      } else if (op.insert) {
        acc.push({ create: { _id: op.insert.id } }, op.insert);
        delete op.insert.id;
      } else if (op.upsert) {
        acc.push({ index: op.upsert.id ? { _id: op.upsert.id } : {} }, op.upsert);
        delete op.upsert.id;
      } else if (op.update) {
        acc.push({ update: { _id: op.update.id } }, { doc: op.update });
        delete op.update.id;
      }
      return acc;
    }, [] as any);

    const res: EsBulkResponse = await this.client.bulk({
      ...this.getIdentity(cls),
      body,
      refresh: true
    });

    const out: BulkResponse = {
      counts: {
        delete: 0,
        insert: 0,
        upsert: 0,
        update: 0,
        error: 0
      },
      errors: [] as EsBulkError[]
    };

    for (const item of res.items) {
      const k = Object.keys(item)[0] as (keyof typeof res.items[0]);
      const v = item[k]!;
      if (v.error) {
        out.errors.push(v.error);
        out.counts.error += 1;
      } else {
        let sk: string = k;
        if (sk === 'create') {
          sk = 'insert';
        } else if (sk === 'index') {
          sk = 'upsert';
        }
        (out.counts as any)[sk as any] += 1;
      }
    }

    return out;
  }
}