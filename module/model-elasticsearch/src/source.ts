import * as es from '@elastic/elasticsearch';
import { Reindex, Search, Index, Update, DeleteByQuery } from '@elastic/elasticsearch/api/requestParams';

/* eslint-disable @typescript-eslint/camelcase */

import {
  ModelSource, Query,
  BulkResponse, BulkOp,
  ModelRegistry, ModelCore,
  PageableModelQuery,
  SelectClause,
  BulkProcessError,
  ModelQuery, WhereClause,
  ValidStringFields, ModelUtil
} from '@travetto/model';
import { Class, ChangeEvent } from '@travetto/registry';
import { Util, AppError } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { SchemaChangeEvent, SchemaRegistry } from '@travetto/schema';

import { ElasticsearchModelConfig } from './config';
import { EsIdentity, EsBulkError } from './types';
import { ElasticsearchUtil } from './util';

type Agg =
  Record<any, {
    buckets: { doc_count: number, key: string }[];
  }>;

interface SearchResponse<T> {
  hits: {
    total: number;
    hits: {
      _source: T;
      _index: string;
      _id: string;
      type: string;
    }[];
  };

  aggregations: Agg;
  aggs: Agg;
}

@Injectable()
// TODO: Document
export class ElasticsearchModelSource extends ModelSource {

  private indexToAlias: Map<string, string> = new Map();
  private aliasToIndex: Map<string, string> = new Map();

  private identities: Map<Class, EsIdentity> = new Map();
  // private indices: Record<string, IndexConfig<any>[]> = {};
  private indexToClass: Map<string, Class> = new Map();
  public client: es.Client;

  constructor(private config: ElasticsearchModelConfig) {
    super();
  }

  async postConstruct() {
    await this.initClient();
    await this.initDatabase();
  }

  generateId() {
    return Util.uuid();
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
    idx = this.indexToAlias.get(idx) ?? idx;

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
      const { body: aliases } = (await this.client.cat.aliases({
        format: 'json'
      })) as { body: { index: string, alias: string }[] };

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
    const schema = ElasticsearchUtil.generateSourceSchema(cls, this.config.schemaConfig);
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
      console.trace('Index', JSON.stringify({
        mappings: {
          [ident.type]: schema
        },
        settings: this.config.indexCreate
      }, null, 2));
    } catch (e) {
      console.debug(`Index ${ident.index} already created`);
    }
    return concreteIndex;
  }

  async onSchemaChange(e: SchemaChangeEvent) {
    const removes = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'removing')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    const typeChanges = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'changed')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    const { index, type } = this.getIdentity(e.cls);

    if (removes.length || typeChanges.length) { // Removing and adding
      const next = await this.createIndex(e.cls, false);

      const aliases = await this.client.indices.getAlias({ index });
      const curr = Object.keys(aliases)[0];

      const allChange = removes.concat(typeChanges);

      // Reindex
      await this.client.reindex({
        body: {
          source: { index: curr },
          dest: { index: next },
          script: {
            lang: 'painless',
            inline: allChange.map(x => `ctx._source.remove("${x}");`).join(' ') // Removing
          }
        },
        waitForCompletion: true
      } as Reindex);

      await Promise.all(Object.keys(aliases)
        .map(x => this.client.indices.delete({ index: x })));

      await this.client.indices.putAlias({ index: next, name: index });
    } else { // Only update
      const schema = ElasticsearchUtil.generateSourceSchema(e.cls, this.config.schemaConfig);

      await this.client.indices.putMapping({
        index,
        type,
        body: schema
      });
    }
  }

  onChange<T extends ModelCore>(e: ChangeEvent<Class<T>>): void {
    console.debug('Model Changed', e);

    if (!this.config.autoCreate) {
      return;
    }

    // Handle ADD/REMOVE
    if (e.prev && !e.curr) { // Removing
      this.client.indices.delete({
        index: this.getNamespacedIndex(this.getCollectionName(e.prev))
      });
    } else if (e.curr && !e.prev) { // Adding
      this.createIndexIfMissing(e.curr!);
    }
  }

  getPlainSearchObject<T extends ModelCore>(cls: Class<T>, query: Query<T>): Search {

    const conf = ModelRegistry.get(cls);
    const q = ElasticsearchUtil.extractWhereQuery(cls, query.where! ?? {}, this.config.schemaConfig);
    const search: Search = {
      body: q ? { query: q } : {}
    };

    const sort = query.sort ?? conf.defaultSort;

    if (query.select) {
      const [inc, exc] = ElasticsearchUtil.getSelect(query.select);
      if (inc.length) {
        // search._sourceInclude = inc;
        (search as any)['_sourceIncludes'] = inc;
      }
      if (exc.length) {
        // search._sourceExclude = exc;
        (search as any)['_sourceExcludes'] = exc;
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

  getSearchObject<T>(cls: Class<T>, query: Query<T>): Search {
    const conf = ModelRegistry.get(cls);

    if (conf.subType) {
      query.where = (query.where ? { $and: [query.where, { type: conf.subType }] } : { type: conf.subType }) as WhereClause<T>;
    }

    const res = this.getPlainSearchObject(cls, query);
    Object.assign(res, this.getIdentity(cls));
    return res;
  }

  safeLoad<T, U = T>(req: Search, results: SearchResponse<T>): U[] {
    const out: T[] = [];

    // determine if id
    const select = [(req as any)._sourceIncludes as string[] ?? [], (req as any)._sourceExcludes as string[] ?? []];
    const includeId = select[0].includes('_id') || (select[0].length === 0 && !select[1].includes('_id'));

    for (const r of results.hits.hits) {
      const obj = r._source;
      if (includeId) {
        (obj as any)._id = r._id;
      }
      out.push(obj);
    }

    return out as any as U[];
  }

  async execSearch<T>(search: Search<T>): Promise<SearchResponse<T>> {
    const { body } = await this.client.search(search);
    return body as SearchResponse<T>;
  }

  async query<T extends ModelCore, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const req = this.getSearchObject(cls, query);
    console.trace('Querying', JSON.stringify(req, null, 2));
    const results = await this.execSearch(req);
    return this.safeLoad(req, results) as any as U[];
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

  async initClient() {
    this.client = new es.Client({
      nodes: this.config.hosts,
      ...(this.config.options || {})
    });
    await this.client.cluster.health({});
  }

  async initDatabase() {
    // PreCreate indexes if missing
    if (this.config.autoCreate) {
      const all = ModelRegistry.getClasses()
        .filter(x => !ModelRegistry.get(x).subType)
        .map(x => this.createIndexIfMissing(x));
      await Promise.all(all);
    }

    await this.computeAliasMappings(true);
  }

  async clearDatabase() {
    await this.client.indices.delete({
      index: this.getNamespacedIndex('*'),
    });
  }

  async suggest<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    const search = this.buildRawMultiSuggestQuery([cls], field, prefix, {
      select: { [field]: 1 } as any,
      ...query
    });
    const res = await this.execSearch(search);
    const safe = this.safeLoad<T>(search, res);
    return ModelUtil.combineSuggestResults(cls, field, prefix, safe, x => x, query && query.limit);
  }

  async facet<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const q = query && query.where ? ElasticsearchUtil.extractWhereQuery(cls, query.where) : { match_all: {} };
    const search = {
      ...this.getIdentity(cls),
      body: {
        query: q,
        aggs: {
          [field]: {
            terms: {
              field,
              size: 100
            },
          }
        }
      },
      size: 0
    };

    const res = await this.execSearch(search);
    const { buckets } = res.aggregations[field];
    const out = buckets.map(({ key, doc_count }) => ({ key, count: doc_count }));
    return out;
  }

  async suggestEntities<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const search = this.buildRawMultiSuggestQuery([cls], field, prefix, query);
    const res = await this.execSearch(search);
    const safe = this.safeLoad<T>(search, res);
    return ModelUtil.combineSuggestResults(cls, field, prefix, safe, (x, v) => v, query && query.limit);
  }

  async getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>) {
    const res = await this.execSearch(this.getSearchObject(cls, {
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

  async convertRawResponse<T extends ModelCore>(response: SearchResponse<T>) {
    const out: T[] = [];

    for (const item of response.hits.hits) {
      const itemCls = this.getClassFromIndexType(item._index, item._source.type!);
      const obj: T = itemCls.from(item._source as T);
      obj.id = item._id;
      this.postLoad(itemCls, obj);
      if (obj.postLoad) {
        await obj.postLoad();
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
      idx = this.aliasToIndex.get(idx) ?? idx;
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
    classes: Class<T>[], field: ValidStringFields<T>, query?: string,
    filter?: Query<T>
  ) {
    const spec = SchemaRegistry.getViewSchema(classes[0]).schema[field as any].specifier;
    const text = spec && spec.startsWith('text');

    if (!text) {
      console.warn(`${classes[0].__id}.${field} is not registered as @Text, reverting to keyword search`);
    }

    const res = this.buildRawMultiQuery(classes, filter, query ? {
      match_phrase_prefix: {
        [text ? `${field}.text` : field]: {
          query
        }
      }
    } : {});

    res.size = filter?.limit ?? 10;

    return res;
  }

  buildRawMultiQuery<T extends ModelCore = ModelCore>(classes: Class<T>[], query?: Query<T>, raw?: any) {
    const searchObj = this.getPlainSearchObject(classes[0], query ?? {});
    searchObj.body = {
      query: {
        bool: {
          must: [
            searchObj.body.query ?? { match_all: {} },
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
    return this.execSearch(searchObj);

  }

  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
    return this.query(cls, query);
  }

  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const results = await this.execSearch(this.getSearchObject(cls, {
      ...query,
      limit: 0
    }));
    return results.hits.total;
  }
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
    const res = await this.getAllByQuery(cls, { limit: 2, ...query });
    return ModelUtil.verifyGetSingleCounts(cls, res, failOnMany);
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    try {
      const res = await this.getByQuery(cls, { where: { id } } as any as ModelQuery<T>);
      return res;
    } catch (err) {
      throw new AppError(`Invalid number of results for find by id: 0`, 'notfound');
    }
  }

  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      try {
        await this.getById(cls, id);
      } catch (e) {
        throw new AppError(`Invalid delete, no ${cls.name} found with id '${id}'`, 'notfound');
      }
    }

    const { body: res } = await this.client.delete({
      ...this.getIdentity(cls),
      id,
      refresh: 'true'
    });
    return res.found ? 1 : 0;
  }

  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}): Promise<number> {
    const { body: res } = await this.client.deleteByQuery(this.getSearchObject(cls, query) as DeleteByQuery);
    return res.deleted ?? 0;
  }

  async save<T extends ModelCore>(cls: Class<T>, o: T, keepId: boolean = false): Promise<T> {
    const id = keepId ? o.id : undefined;
    delete o.id;

    const { body: res } = await this.client.index({
      ...this.getIdentity(o.constructor as Class),
      ... (id ? { id } : {}),
      refresh: 'true',
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
    }

    const res = await this.bulkProcess(cls, objs.map(x => ({ upsert: x })));
    if (res.counts.error > 0) {
      throw new BulkProcessError(res.errors);
    }

    for (const idx of res.insertedIds.keys()) {
      objs[idx].id = res.insertedIds.get(idx)!;
    }

    return objs;
  }

  async update<T extends ModelCore>(cls: Class<T>, o: T): Promise<T> {
    const id = o.id!;
    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      try {
        await this.getById(cls, id);
      } catch (e) {
        throw new AppError(`Invalid update, no ${cls.name} found with id '${id}'`, 'notfound');
      }

    }
    delete o.id;
    await this.client.index({
      ...this.getIdentity(cls),
      id,
      opType: 'index',
      refresh: 'true',
      body: o
    } as Index);
    o.id = id;

    return this.getById(cls, id);
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, data: Partial<T> & { id: string }): Promise<T> {
    const id = data.id;
    const script = ElasticsearchUtil.generateUpdateScript(data);

    console.debug('Partial Script', script);

    await this.client.update({
      ...this.getIdentity(cls),
      id,
      refresh: 'true',
      body: {
        script
      }
    } as Update);

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

    const script = ElasticsearchUtil.generateUpdateScript(data);

    const { body: res } = await this.client.updateByQuery({
      ...this.getIdentity(cls),
      refresh: true,
      body: {
        query: this.getSearchObject(cls, query).body.query,
        script
      }
    });

    return res.updated;
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]) {

    const body = operations.reduce((acc, op) => {

      const esIdent = this.getIdentity((op.upsert ?? op.delete ?? op.insert ?? op.update ?? { constructor: cls }).constructor as Class);
      const ident = { _index: esIdent.index, _type: esIdent.type };

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

    const { body: res } = await this.client.bulk({
      body,
      refresh: 'true'
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
        let sk: string = k as string;
        if (sk === 'create') {
          sk = 'insert';
        } else if (sk === 'index') {
          sk = operations[i].insert ? 'insert' : 'upsert';
        }

        if (v.result === 'created') {
          out.insertedIds.set(i, v._id);
          (operations[i].insert ?? operations[i].upsert)!.id = v._id;
        }

        (out.counts as any)[sk as any] += 1;
      }
    }

    return out;
  }
}