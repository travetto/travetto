import * as es from 'elasticsearch';

import {
  ModelSource, Query,
  BulkResponse, BulkOp,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  SelectClause,
  ModelQuery, WhereClause,
  ValidStringFields
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { Util, Env, AppError } from '@travetto/base';
import { SchemaChangeEvent, SchemaRegistry } from '@travetto/schema';

import { ModelElasticsearchConfig } from './config';
import { EsBulkResponse, EsIdentity, EsBulkError } from './types';
import { ElasticsearchUtil } from './util';

export class ModelElasticsearchSource extends ModelSource {

  private indexToAlias: Map<string, string> = new Map();
  private aliasToIndex: Map<string, string> = new Map();

  private identities: Map<Class, EsIdentity> = new Map();
  // private indices: { [key: string]: IndexConfig<any>[] } = {};
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

  getCollectionName(cls: Class) {
    return ModelRegistry.getBaseCollection(cls)!;
  }

  getClassFromIndexType(idx: string, type: string) {
    idx = this.indexToAlias.get(idx) || idx;

    const key = `${idx}.${type}`;
    if (!this.indexToClass.has(key)) {
      let index = idx;
      if (this.config.namespace) {
        index = idx.replace(`${this.config.namespace}_`, '');
      }
      const clsList = ModelRegistry.getClasses()
        .filter(x => index === ModelRegistry.getCollectionName(x))!;

      let cls: Class;

      if (clsList.length > 1) {
        cls = clsList.find(c => !!ModelRegistry.get(c).baseType)!;
        cls = ModelRegistry.getClassesByBaseType(cls)
          .find(x => ModelRegistry.get(x).subType === type)!;
      } else {
        [cls] = clsList;
      }

      this.indexToClass.set(key, cls);
    }
    return this.indexToClass.get(key)!;
  }

  getIdentity<T extends ModelCore>(cls: Class<T>): EsIdentity {
    if (!this.identities.has(cls)) {
      const col = this.getCollectionName(cls);
      const index = this.getNamespacedIndex(col);
      this.identities.set(cls, { index, type: '_doc' });
    }
    return { ...this.identities.get(cls)! };
  }

  async computeAliasMappings(force = false) {
    if (force || !this.indexToAlias.size) {
      const aliases = (await this.client.cat.aliases({
        format: 'json'
      })) as { index: string, alias: string }[];
      this.indexToAlias = new Map();
      this.aliasToIndex = new Map();
      for (const al of aliases) {
        this.indexToAlias.set(al.index, al.alias);
        this.aliasToIndex.set(al.alias, al.index);
      }
    }
  }

  async createIndexIfMissing(cls: Class) {
    cls = ModelRegistry.getBaseModel(cls);
    const ident = this.getIdentity(cls);
    try {
      await this.client.search(ident);
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
          },
          settings: this.config.indexCreate
        }
      });
      if (alias) {
        this.indexToAlias.set(concreteIndex, ident.index);
        this.aliasToIndex.set(ident.index, concreteIndex);
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
        index: this.getNamespacedIndex(this.getCollectionName(e.prev))
      });
    } else if (e.curr && !e.prev) { // Adding
      this.createIndexIfMissing(e.curr!);
    }
  }

  getPlainSearchObject<T extends ModelCore>(cls: Class<T>, query: Query<T>) {

    const conf = ModelRegistry.get(cls);
    const q = ElasticsearchUtil.extractWhereQuery(query.where! || {}, cls);
    const search: es.SearchParams = {
      body: q ? { query: q } : {}
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
      search.sort = ElasticsearchUtil.getSort(sort);
    }

    if (query.offset) {
      search.from = query.offset;
    }

    if (query.limit) {
      search.size = query.limit;
    }

    return search;
  }

  getSearchObject<T>(cls: Class<T>, query: Query<T>) {
    const conf = ModelRegistry.get(cls);

    if (conf.subType) {
      query.where = (query.where ? { $and: [query.where, { type: conf.subType }] } : { type: conf.subType }) as WhereClause<T>;
    }

    const res = this.getPlainSearchObject(cls, query);
    Object.assign(res, this.getIdentity(cls));
    return res;
  }

  safeLoad<T>(req: es.SearchParams, results: es.SearchResponse<T>): T[] {
    const out: T[] = [];

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

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const req = this.getSearchObject(cls, query);
    const results = await this.client.search<U>(req);
    return this.safeLoad<U>(req, results);
  }

  postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
    if ((o as any)._id) {
      o.id = (o as any)._id as string;
      delete (o as any)._id;
    }
    return o;
  }

  prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
    return o;
  }

  cleanseId<T extends ModelCore>(o: T) {
    if (o.id) {
      (o as any)._id = o.id as string;
      delete o.id;
    }
    return (o as any)._id;
  }

  extractId<T extends ModelCore>(o: T) {
    const id = this.cleanseId(o);
    delete (o as any)._id;
    return id;
  }

  async postConstruct() {
    await this.init();
  }

  async init() {
    this.client = new es.Client(Util.deepAssign({}, this.config));
    await this.client.cluster.health({});

    // PreCreate indexes if missing
    if (!Env.prod) {
      const all = ModelRegistry.getClasses()
        .filter(x => !ModelRegistry.get(x).subType)
        .map(x => this.createIndexIfMissing(x));
      await Promise.all(all);
    }

    await this.computeAliasMappings(true);
  }

  async resetDatabase() {
    await this.client.indices.delete({
      index: this.getNamespacedIndex('*')
    });
    await this.init();
  }

  async suggestField<T extends ModelCore, U = T>(
    cls: Class<T>, field: ValidStringFields<T>, query: string, filter?: PageableModelQuery<T>
  ): Promise<U[]> {
    const search = this.buildRawMultiSuggestQuery([cls], field, query, filter);
    const res = await this.client.search<U>(search);
    return this.safeLoad<U>(search, res);
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>) {
    const res = await this.client.search<ModelCore>(this.getSearchObject(cls, {
      select: {
        id: 1
      } as any as SelectClause<T>,
      ...query
    }));
    return res.hits.hits.map(x => x._source.id);
  }

  getIndices<T extends ModelCore>(classes: Class<T>[]) {
    return classes.map(t => this.getIdentity(t).index).join(',');
  }

  async convertRawResponse<T extends ModelCore>(response: es.SearchResponse<T>) {
    const out: T[] = [];

    for (const item of response.hits.hits) {
      const itemCls = this.getClassFromIndexType(item._index, item._source.type!);
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

  buildRawModelFilters<T extends ModelCore = ModelCore>(classes: Class<T>[]) {
    const types = classes.map(t => {
      const conf = ModelRegistry.get(t);
      let idx = this.getIdentity(conf.class).index;
      idx = this.aliasToIndex.get(idx) || idx;
      if (!conf.subType) {
        return { term: { _index: idx } };
      } else {
        return {
          bool: {
            must: [
              { term: { _index: idx } },
              { term: { type: conf.subType } },
            ]
          }
        };
      }
    });

    return {
      bool: {
        minimum_should_match: 1,
        should: types
      }
    };
  }

  buildRawMultiSuggestQuery<T extends ModelCore = ModelCore>(
    classes: Class<T>[], field: ValidStringFields<T>, query: string,
    filter?: PageableModelQuery<T>
  ) {
    const spec = SchemaRegistry.getViewSchema(classes[0]).schema[field as any].specifier;
    const text = spec && spec.startsWith('text');

    if (!text) {
      console.warn(`${classes[0].__id}.${field} is not registered as @Text, reverting to keyword search`);
    }

    const res = this.buildRawMultiQuery(classes, filter, {
      match_phrase_prefix: {
        [text ? `${field}.text` : field]: {
          query
        }
      }
    });

    res.size = filter && filter.limit || 10;

    return res;
  }

  buildRawMultiQuery<T extends ModelCore = ModelCore>(classes: Class<T>[], query?: Query<T>, raw?: any) {
    const searchObj = this.getPlainSearchObject(classes[0], query || {});
    searchObj.body = {
      query: {
        bool: {
          must: [
            searchObj.body.query || { match_all: {} },
            ...(raw ? [raw] : [])
          ],
          filter: this.buildRawModelFilters(classes)
        }
      }
    };
    return searchObj;
  }

  async getRawMultiQuery<T extends ModelCore = ModelCore>(classes: Class<T>[], query: Query<T>) {
    const searchObj = this.buildRawMultiQuery(classes, query);
    return await this.client.search<T>(searchObj);

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
      throw new AppError(`Invalid number of results for find by id: ${res ? res.length : res}`);
    }
    return res[0] as T;
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    try {
      const res = await this.getByQuery(cls, { where: { id } } as any as ModelQuery<T>);
      return res;
    } catch (err) {
      throw new AppError(`Invalid number of results for find by id: 0`);
    }
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      try {
        await this.getById(cls, id);
      } catch (e) {
        throw new AppError(`Invalid delete, no ${cls.name} found with id '${id}'`);
      }
    }

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
    this.cleanseId(o);

    const res = await this.client.index({
      ...this.getIdentity(o.constructor as Class),
      refresh: true,
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
      this.cleanseId(x);
    }

    const res = await this.bulkProcess(cls, objs.map(x => ({ upsert: x })));
    for (const idx of res.insertedIds.keys()) {
      objs[idx].id = res.insertedIds.get(idx)!;
    }

    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    const id = this.extractId(o);
    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      try {
        await this.getById(cls, id);
      } catch (e) {
        throw new AppError(`Invalid update, no ${cls.name} found with id '${id}'`);
      }

    }
    const res = await this.client.index({
      ...this.getIdentity(cls),
      id,
      opType: 'index',
      refresh: true,
      body: o
    });
    return this.getById(cls, id);
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    const id = this.extractId(data);

    await this.client.update({
      ...this.getIdentity(cls),
      id,
      refresh: true,
      body: { doc: data }
    });

    return this.getById(cls, id);
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
    if (!data.id) {
      const item = await this.getByQuery(cls, query);
      this.postLoad(cls, item);
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

      const _ident = this.getIdentity((op.upsert || op.delete || op.insert || op.update || { constructor: cls }).constructor as Class);
      const ident = { _index: _ident.index, _type: _ident.type };

      if (op.delete) {
        acc.push({ ['delete']: { ...ident, _id: op.delete.id } });
      } else if (op.insert) {
        if (op.insert.id) {
          acc.push({ create: { ...ident, _id: op.insert.id } }, op.insert);
          delete op.insert.id;
        } else {
          acc.push({ index: { ...ident } }, op.insert);
        }
      } else if (op.upsert) {
        acc.push({ index: { ...ident, ...(op.upsert.id ? { _id: op.upsert.id } : {}) } }, op.upsert);
        delete op.upsert.id;
      } else if (op.update) {
        acc.push({ update: { ...ident, _id: op.update.id } }, { doc: op.update });
        delete op.update.id;
      }
      return acc;
    }, [] as any);

    const res: EsBulkResponse = await this.client.bulk({
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
      insertedIds: new Map(),
      errors: [] as EsBulkError[]
    };

    for (let i = 0; i < res.items.length; i++) {
      const item = res.items[i];
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

        if (v.result === 'created') {
          out.insertedIds.set(i, v._id);
        }

        (out.counts as any)[sk as any] += 1;
      }
    }

    return out;
  }
}