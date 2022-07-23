import {
  ModelType,
  BulkOp, BulkResponse, ModelCrudSupport, ModelStorageSupport, ModelBulkSupport,
  NotFoundError, ModelRegistry, ExistsError, OptionalId
} from '@travetto/model';
import { Util, Class } from '@travetto/base';
import { SchemaChange } from '@travetto/schema';
import { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import {
  ModelQuery, ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySupport,
  PageableModelQuery, ValidStringFields, WhereClauseRaw
} from '@travetto/model-query';

import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelQuerySuggestUtil } from '@travetto/model-query/src/internal/service/suggest';
import { ModelQueryExpiryUtil } from '@travetto/model-query/src/internal/service/expiry';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';
import { ModelQuerySuggestSupport } from '@travetto/model-query/src/service/suggest';
import { ModelBulkUtil } from '@travetto/model/src/internal/service/bulk';

import { SQLModelConfig } from './config';
import { Connected, ConnectedIterator, Transactional } from './connection/decorator';
import { SQLUtil } from './internal/util';
import { SQLDialect } from './dialect/base';
import { TableManager } from './table-manager';
import { Connection } from './connection/base';
import { InsertWrapper } from './internal/types';

/**
 * Core for SQL Model Source.  Should not have any direct queries,
 * but should offload all of that to the dialect, so it can be overridden
 * as needed.
 */
@Injectable()
export class SQLModelService implements
  ModelCrudSupport, ModelStorageSupport,
  ModelBulkSupport, ModelQuerySupport,
  ModelQueryCrudSupport, ModelQueryFacetSupport,
  ModelQuerySuggestSupport {

  #manager: TableManager;
  #context: AsyncContext;
  #dialect: SQLDialect;

  readonly config: SQLModelConfig;

  get client(): SQLDialect {
    return this.#dialect;
  }

  constructor(
    context: AsyncContext,
    config: SQLModelConfig,
    dialect: SQLDialect
  ) {
    this.#context = context;
    this.#dialect = dialect;
    this.config = config;
  }

  /**
   * Verify upserted ids for bulk operations
   */
  async #checkUpsertedIds<T extends ModelType>(
    cls: Class<T>,
    addedIds: Map<number, string>,
    toCheck: Map<string, number>
  ): Promise<Map<number, string>> {
    // Get all upsert ids
    const all = toCheck.size ?
      (await this.#exec<ModelType>(
        this.#dialect.getSelectRowsByIdsSQL(
          SQLUtil.classToStack(cls), [...toCheck.keys()], [this.#dialect.idField]
        )
      )).records : [];

    const allIds = new Set(all.map(el => el.id));

    for (const [el, idx] of toCheck.entries()) {
      if (!allIds.has(el)) { // If not found
        addedIds.set(idx, el);
      }
    }

    return addedIds;
  }

  #exec<T = unknown>(sql: string): Promise<{ records: T[], count: number }> {
    return this.#dialect.executeSQL<T>(sql);
  }

  async #deleteRaw<T extends ModelType>(cls: Class<T>, id: string, checkExpiry = true): Promise<void> {
    const where: WhereClauseRaw<ModelType> = { id };
    const count = await this.#dialect.deleteAndGetCount<ModelType>(cls, {
      where: ModelQueryUtil.getWhereClause(cls, where, checkExpiry)
    });
    if (count === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async postConstruct(): Promise<void> {
    if (this.#dialect) {
      if (this.#dialect.conn.init) {
        await this.#dialect.conn.init();
      }
      this.#manager = new TableManager(this.#context, this.#dialect);
      await ModelStorageUtil.registerModelChangeListener(this);
      ModelExpiryUtil.registerCull(this);
    }
  }

  get conn(): Connection {
    return this.#dialect.conn;
  }

  uuid(): string {
    return this.#dialect.generateId();
  }

  async changeSchema(cls: Class, change: SchemaChange): Promise<void> {
    await this.#manager.changeSchema(cls, change);
  }

  async createModel(cls: Class): Promise<void> {
    await this.#manager.createTables(cls);
  }

  async deleteModel(cls: Class): Promise<void> {
    await this.#manager.dropTables(cls);
  }

  async truncateModel(cls: Class): Promise<void> {
    await this.#manager.truncateTables(cls);
  }

  async createStorage(): Promise<void> { }
  async deleteStorage(): Promise<void> { }

  @Transactional()
  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    try {
      for (const ins of this.#dialect.getAllInsertSQL(cls, prepped)) {
        await this.#exec(ins);
      }
    } catch (err) {
      if (err instanceof ExistsError) {
        throw new ExistsError(cls, prepped.id);
      } else {
        throw err;
      }
    }
    return prepped;
  }

  @Transactional()
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.#deleteRaw(cls, item.id, true);
    return await this.create(cls, item);
  }

  @Transactional()
  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    try {
      if (item.id) {
        await this.#deleteRaw(cls, item.id, false);
      }
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }
    return await this.create(cls, item);
  }

  @Transactional()
  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }): Promise<T> {
    const id = item.id;
    const final = await ModelCrudUtil.naivePartialUpdate(cls, item, undefined, () => this.get(cls, id));
    return this.update(cls, final);
  }

  @Connected()
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const where: WhereClauseRaw<ModelType> = { id };
    const res = await this.query(cls, { where });
    if (res.length === 1) {
      return await ModelCrudUtil.load(cls, res[0]);
    }
    throw new NotFoundError(cls, id);
  }

  @ConnectedIterator()
  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for (const item of await this.query(cls, {})) {
      yield await ModelCrudUtil.load(cls, item);
    }
  }

  @Transactional()
  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    await this.#deleteRaw(cls, id, false);
  }

  @Transactional()
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse> {

    const { insertedIds, upsertedIds, existingUpsertedIds } = await ModelBulkUtil.preStore(cls, operations, this);

    const addedIds = new Map([...insertedIds.entries(), ...upsertedIds.entries()]);

    await this.#checkUpsertedIds(cls,
      addedIds,
      new Map([...existingUpsertedIds.entries()].map(([k, v]) => [v, k]))
    );

    const get = (k: keyof BulkOp<T>): T[] =>
      operations.map(x => x[k]).filter((x): x is T => !!x);
    const getStatements = async (k: keyof BulkOp<T>): Promise<InsertWrapper[]> =>
      (await SQLUtil.getInserts(cls, get(k))).filter(x => !!x.records.length);

    const deletes = [{ stack: SQLUtil.classToStack(cls), ids: get('delete').map(x => x.id) }].filter(x => !!x.ids.length);

    const [inserts, upserts, updates] = await Promise.all([
      getStatements('insert'),
      getStatements('upsert'),
      getStatements('update')
    ]);

    const ret = await this.#dialect.bulkProcess(deletes, inserts, upserts, updates);
    ret.insertedIds = addedIds;
    return ret;
  }

  // Expiry
  @Transactional()
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return ModelQueryExpiryUtil.deleteExpired(this, cls);
  }

  @Connected()
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    const { records: res } = await this.#exec<T>(this.#dialect.getQuerySQL(cls, ModelQueryUtil.getQueryAndVerify(cls, query)));
    if (ModelRegistry.has(cls)) {
      await this.#dialect.fetchDependents(cls, res, query && query.select);
    }

    const cleaned = SQLUtil.cleanResults<T>(this.#dialect, res);
    return await Promise.all(cleaned.map(m => ModelCrudUtil.load(cls, m)));
  }

  @Connected()
  async queryOne<T extends ModelType>(cls: Class<T>, builder: ModelQuery<T>, failOnMany = true): Promise<T> {
    const res = await this.query(cls, { ...builder, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts(cls, res, failOnMany);
  }

  @Connected()
  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    const { records } = await this.#exec<{ total: string | number }>(this.#dialect.getQueryCountSQL(cls, ModelQueryUtil.getQueryAndVerify(cls, query)));
    return +records[0].total;
  }

  @Connected()
  @Transactional()
  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    const { count } = await this.#exec(this.#dialect.getUpdateSQL(SQLUtil.classToStack(cls), data, ModelQueryUtil.getQueryAndVerify(cls, query).where));
    return count;
  }

  @Connected()
  @Transactional()
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    const { count } = await this.#exec(this.#dialect.getDeleteSQL(SQLUtil.classToStack(cls), ModelQueryUtil.getQueryAndVerify(cls, query, false).where));
    return count;
  }

  @Connected()
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    const q = ModelQuerySuggestUtil.getSuggestQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, (a, b) => b, query?.limit);
  }

  @Connected()
  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    const q = ModelQuerySuggestUtil.getSuggestFieldQuery(cls, field, prefix, query);
    const results = await this.query(cls, q);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const modelTypeField = field as ValidStringFields<ModelType>;
    return ModelQuerySuggestUtil.combineSuggestResults(cls, modelTypeField, prefix, results, x => x, query?.limit);
  }

  @Connected()
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
    const col = this.#dialect.ident(field);
    const ttl = this.#dialect.ident('count');
    const key = this.#dialect.ident('key');
    const q = [
      `SELECT ${col} as ${key}, COUNT(${col}) as ${ttl}`,
      this.#dialect.getFromSQL(cls),
    ];
    q.push(
      this.#dialect.getWhereSQL(cls, ModelQueryUtil.getQueryAndVerify(cls, query ?? {}).where)
    );
    q.push(
      `GROUP BY ${col}`,
      `ORDER BY ${ttl} DESC`
    );

    const results = await this.#exec<{ key: string, count: number }>(q.join('\n'));
    return results.records.map(x => {
      x.count = Util.coerceType(x.count, Number);
      return x;
    });
  }
}