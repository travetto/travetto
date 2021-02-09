import {
  ModelType,
  BulkOp, BulkResponse, ModelCrudSupport, ModelStorageSupport, ModelBulkSupport,
  NotFoundError, ModelRegistry
} from '@travetto/model';
import { Util, Class } from '@travetto/base';
import { SchemaChange } from '@travetto/schema';
import { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySupport,
  PageableModelQuery, ValidStringFields, WhereClause
} from '@travetto/model-query';

import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { QueryLanguageParser } from '@travetto/model-query/src/internal/query/parser';
import { QueryVerifier } from '@travetto/model-query/src/internal/query/verifier';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { SQLModelConfig } from './config';
import { Connected, ConnectedIterator, Transactional } from './connection/decorator';
import { SQLUtil } from './internal/util';
import { SQLDialect } from './dialect/base';
import { TableManager } from './table-manager';

function prepareQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): ModelQuery<T> & { where: WhereClause<T> } {

  if (query.where && typeof query.where === 'string') {
    query.where = QueryLanguageParser.parseToQuery(query.where);
  }

  const conf = ModelRegistry.get(cls);

  // Polymorphism
  if (conf.subType) {
    query.where = (query.where ?
      { $and: [query.where ?? {}, { type: conf.subType }] } :
      { type: conf.subType }) as WhereClause<T>;
  }

  QueryVerifier.verify(cls, query);

  return query as ModelQuery<T> & { where: WhereClause<T> };
}

/**
 * Core for SQL Model Source.  Should not have any direct queries,
 * but should offload all of that to the dialect, so it can be overridden
 * as needed.
 */
@Injectable()
export class SQLModelService implements
  ModelCrudSupport, ModelStorageSupport,
  ModelBulkSupport, ModelQuerySupport,
  ModelQueryCrudSupport, ModelQueryFacetSupport {

  private manager: TableManager;

  constructor(
    public readonly context: AsyncContext,
    public readonly config: SQLModelConfig,
    public readonly dialect: SQLDialect
  ) {
  }

  /**
   * Compute new ids for bulk operations
   */
  private async computeInsertedIds<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]) {
    const addedIds = new Map<number, string>();
    const toCheck = new Map<string, number>();

    // Compute ids
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const target = op.insert || op.upsert;
      if (target) {
        if (!target.id) {
          target.id = this.uuid();
          addedIds.set(i, target.id!);
        } else if (op.upsert) {
          toCheck.set(target.id, i);
        } else if (op.insert) {
          addedIds.set(i, target.id!);
        }
      }
    }

    // Get all upsert ids
    const all = toCheck.size ?
      (await this.exec<ModelType>(
        this.dialect.getSelectRowsByIdsSQL(
          SQLUtil.classToStack(cls), [...toCheck.keys()], [this.dialect.idField]
        )
      )).records : [];

    for (const el of all) {
      toCheck.delete(el.id!);
    }

    for (const [el, idx] of toCheck.entries()) {
      addedIds.set(idx, el);
    }

    return addedIds;
  }

  private exec<T = unknown>(sql: string) {
    return this.dialect.executeSQL<T>(sql);
  }

  async postConstruct() {
    if (this.dialect) {
      if (this.dialect.conn.init) {
        await this.dialect.conn.init();
      }
      this.manager = new TableManager(this.context, this.dialect);
      ModelStorageUtil.registerModelChangeListener(this);
      ModelExpiryUtil.registerCull(this);
    }
  }

  get conn() {
    return this.dialect.conn;
  }

  uuid() {
    return this.dialect.generateId();
  }

  async changeSchema(cls: Class, change: SchemaChange) {
    await this.manager.changeSchema(cls, change);
  }

  async createModel(cls: Class) {
    await this.manager.createTables(cls);
  }

  async deleteModel(cls: Class) {
    await this.manager.dropTables(cls);
  }

  async createStorage() { }
  async deleteStorage() { }

  @Transactional()
  async create<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await ModelCrudUtil.preStore(cls, item, this);
    for (const ins of this.dialect.getAllInsertSQL(cls, item)) {
      await this.exec(ins);
    }
    return item;
  }

  @Transactional()
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.delete(cls, item.id!);
    return await this.create(cls, item);
  }

  @Transactional()
  async upsert<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    try {
      await this.delete(cls, item.id!);
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }
    return await this.create(cls, item);
  }

  @Transactional()
  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>): Promise<T> {
    const final = await ModelCrudUtil.naivePartialUpdate(cls, item, undefined, () => this.get(cls, id));
    return this.update(cls, final);
  }

  @Connected()
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    // @ts-ignore
    const res = await this.query(cls, { where: { id } } as ModelQuery<T>);
    if (res.length === 1) {
      return await ModelCrudUtil.load(cls, res[0]);
    }
    throw new NotFoundError(cls, id);
  }

  @ConnectedIterator()
  async * list<T extends ModelType>(cls: Class<T>) {
    for (const item of await this.query(cls, {})) {
      yield await ModelCrudUtil.load(cls, item);
    }
  }

  @Transactional()
  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const count = await this.dialect.deleteAndGetCount<ModelType>(cls, { where: { id } });
    if (count === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  @Transactional()
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse> {
    const deleteOps = operations.map(x => x.delete).filter(x => !!x) as T[];
    const insertOps = operations.map(x => x.insert).filter(x => !!x) as T[];
    const upsertOps = operations.map(x => x.upsert).filter(x => !!x) as T[];
    const updateOps = operations.map(x => x.update).filter(x => !!x) as T[];

    const insertedIds = await this.computeInsertedIds(cls, operations);

    const deletes = [{ stack: SQLUtil.classToStack(cls), ids: deleteOps.map(x => x.id!) }].filter(x => !!x.ids.length);
    const inserts = (await SQLUtil.getInserts(cls, insertOps)).filter(x => !!x.records.length);
    const upserts = (await SQLUtil.getInserts(cls, upsertOps)).filter(x => !!x.records.length);
    const updates = (await SQLUtil.getInserts(cls, updateOps)).filter(x => !!x.records.length);

    const ret = await this.dialect.bulkProcess(deletes, inserts, upserts, updates);
    ret.insertedIds = insertedIds;
    return ret;
  }

  // Expiry
  @Transactional()
  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    const item = ModelExpiryUtil.getPartialUpdate(cls, {}, ttl);
    await this.updatePartial(cls, id, item);
  }

  @Connected()
  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const item = await this.get(cls, id);
    return ModelExpiryUtil.getExpiryForItem(cls, item);
  }

  @Transactional()
  async upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number) {
    item = ModelExpiryUtil.getPartialUpdate(cls, item, ttl);
    return await this.upsert(cls, item);
  }

  @Transactional()
  deleteExpired<T extends ModelType>(cls: Class<T>) {
    return ModelQueryExpiryUtil.deleteExpired(this, cls);
  }

  @Connected()
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    const { records: res } = await this.exec<T>(this.dialect.getQuerySQL(cls, await prepareQuery(cls, query)));
    if (ModelRegistry.has(cls)) {
      await this.dialect.fetchDependents(cls, res, query && query.select);
    }

    const cleaned = SQLUtil.cleanResults<T>(this.dialect, res);
    return await Promise.all(cleaned.map(m => ModelCrudUtil.load(cls, m)));
  }

  @Connected()
  async queryOne<T extends ModelType>(cls: Class<T>, builder: ModelQuery<T>, failOnMany = true): Promise<T> {
    const res = await this.query(cls, { ...builder, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts(cls, res, failOnMany);
  }

  @Connected()
  async queryCount<T extends ModelType>(cls: Class<T>, builder: ModelQuery<T>): Promise<number> {
    const { records } = await this.exec<{ total: string | number }>(this.dialect.getQueryCountSQL(cls, await prepareQuery(cls, builder)));
    return +records[0].total;
  }

  @Connected()
  @Transactional()
  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    const { count } = await this.exec(this.dialect.getUpdateSQL(SQLUtil.classToStack(cls), data, (await prepareQuery(cls, query)).where));
    return count;
  }

  @Connected()
  @Transactional()
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    const { count } = await this.exec(this.dialect.getDeleteSQL(SQLUtil.classToStack(cls), (await prepareQuery(cls, query)).where));
    return count;
  }

  @Connected()
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const q = ModelQuerySuggestUtil.getSuggestQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, (a, b) => b, query && query.limit);
  }

  @Connected()
  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    const q = ModelQuerySuggestUtil.getSuggestFieldQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, x => x, query && query.limit);
  }

  @Connected()
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const col = this.dialect.ident(field as string);
    const ttl = this.dialect.ident('count');
    const key = this.dialect.ident('key');
    const q = [
      `SELECT ${col} as ${key}, COUNT(${col}) as ${ttl}`,
      this.dialect.getFromSQL(cls),
    ];
    if (query && query.where) {
      q.push(
        this.dialect.getWhereSQL(cls, prepareQuery(cls, query).where)
      );
    }
    q.push(
      `GROUP BY ${col}`,
      `ORDER BY ${ttl} DESC`
    );

    const results = await this.exec<{ key: string, count: number }>(q.join('\n'));
    return results.records.map(x => {
      x.count = Util.coerceType(x.count, Number);
      return x;
    });
  }
}