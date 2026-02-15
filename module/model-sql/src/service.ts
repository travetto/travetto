import {
  type ModelType,
  type BulkOperation, type BulkResponse, type ModelCrudSupport, type ModelStorageSupport, type ModelBulkSupport,
  NotFoundError, ModelRegistryIndex, ExistsError, type OptionalId, type ModelIdSource,
  ModelExpiryUtil, ModelCrudUtil, ModelStorageUtil, ModelBulkUtil,
} from '@travetto/model';
import { castTo, type Class } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';
import type { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import {
  type ModelQuery, type ModelQueryCrudSupport, type ModelQueryFacetSupport, type ModelQuerySupport,
  type PageableModelQuery, type ValidStringFields, type WhereClauseRaw, QueryVerifier, type ModelQuerySuggestSupport,
  ModelQueryUtil, ModelQuerySuggestUtil, ModelQueryCrudUtil,
  type ModelQueryFacet,
} from '@travetto/model-query';

import type { SQLModelConfig } from './config.ts';
import { Connected, ConnectedIterator, Transactional } from './connection/decorator.ts';
import { SQLModelUtil } from './util.ts';
import type { SQLDialect } from './dialect/base.ts';
import { TableManager } from './table-manager.ts';
import type { Connection } from './connection/base.ts';
import type { InsertWrapper } from './internal/types.ts';

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
  idSource: ModelIdSource;

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
          SQLModelUtil.classToStack(cls), [...toCheck.keys()], [this.#dialect.idField]
        )
      )).records : [];

    const allIds = new Set(all.map(type => type.id));

    for (const [id, idx] of toCheck.entries()) {
      if (!allIds.has(id)) { // If not found
        addedIds.set(idx, id);
      }
    }

    return addedIds;
  }

  #exec<T = unknown>(sql: string): Promise<{ records: T[], count: number }> {
    return this.#dialect.executeSQL<T>(sql);
  }

  async #deleteRaw<T extends ModelType>(cls: Class<T>, id: string, where?: WhereClauseRaw<T>, checkExpiry = true): Promise<void> {
    castTo<WhereClauseRaw<ModelType>>(where ??= {}).id = id;

    const count = await this.#dialect.deleteAndGetCount<ModelType>(cls, {
      where: ModelQueryUtil.getWhereClause(cls, where, checkExpiry)
    });
    if (count === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async postConstruct(): Promise<void> {
    await this.#dialect.connection.init?.();
    this.idSource = ModelCrudUtil.uuidSource(this.#dialect.ID_LENGTH);
    this.#manager = new TableManager(this.#context, this.#dialect);
    await ModelStorageUtil.storageInitialization(this);
    ModelExpiryUtil.registerCull(this);
  }

  get connection(): Connection {
    return this.#dialect.connection;
  }

  async exportModel<T extends ModelType>(cls: Class<T>): Promise<string> {
    return (await this.#manager.exportTables(cls)).join('\n');
  }

  async upsertModel(cls: Class): Promise<void> {
    await this.#manager.upsertTables(cls);
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
    } catch (error) {
      if (error instanceof ExistsError) {
        throw new ExistsError(cls, prepped.id);
      } else {
        throw error;
      }
    }
    return prepped;
  }

  @Transactional()
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.#deleteRaw(cls, item.id, {}, true);
    return await this.create(cls, item);
  }

  @Transactional()
  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    try {
      if (item.id) {
        await this.#deleteRaw(cls, item.id, {}, false);
      }
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }
    return await this.create(cls, item);
  }

  @Transactional()
  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    const id = item.id;
    const final = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    return this.update(cls, final);
  }

  @Connected()
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const result = await this.query(cls, { where: castTo({ id }) });
    if (result.length === 1) {
      return await ModelCrudUtil.load(cls, result[0]);
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
    await this.#deleteRaw(cls, id, {}, false);
  }

  @Transactional()
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse> {

    const { insertedIds, upsertedIds, existingUpsertedIds } = await ModelBulkUtil.preStore(cls, operations, this);

    const addedIds = new Map([...insertedIds.entries(), ...upsertedIds.entries()]);

    await this.#checkUpsertedIds(cls,
      addedIds,
      new Map([...existingUpsertedIds.entries()].map(([key, value]) => [value, key]))
    );

    const get = <K extends keyof BulkOperation<T>>(key: K): Required<BulkOperation<T>>[K][] =>
      operations.map(item => item[key]).filter((item): item is Required<BulkOperation<T>>[K] => !!item);

    const getStatements = async (key: keyof BulkOperation<T>): Promise<InsertWrapper[]> =>
      (await SQLModelUtil.getInserts(cls, get(key))).filter(wrapper => !!wrapper.records.length);

    const deletes = [{ stack: SQLModelUtil.classToStack(cls), ids: get('delete').map(wrapper => wrapper.id) }]
      .filter(wrapper => !!wrapper.ids.length);

    const [inserts, upserts, updates] = await Promise.all([
      getStatements('insert'),
      getStatements('upsert'),
      getStatements('update')
    ]);

    const result = await this.#dialect.bulkProcess(deletes, inserts, upserts, updates);
    result.insertedIds = addedIds;
    return result;
  }

  // Expiry
  @Transactional()
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return ModelQueryCrudUtil.deleteExpired(this, cls);
  }

  @Connected()
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);
    const { records } = await this.#exec<T>(this.#dialect.getQuerySQL(cls, query, ModelQueryUtil.getWhereClause(cls, query.where)));
    if (ModelRegistryIndex.has(cls)) {
      await this.#dialect.fetchDependents(cls, records, query && query.select);
    }

    const cleaned = SQLModelUtil.cleanResults<T>(this.#dialect, records);
    return await Promise.all(cleaned.map(item => ModelCrudUtil.load(cls, item)));
  }

  @Connected()
  async queryOne<T extends ModelType>(cls: Class<T>, builder: ModelQuery<T>, failOnMany = true): Promise<T> {
    const results = await this.query<T>(cls, { ...builder, limit: failOnMany ? 2 : 1 });
    return ModelQueryUtil.verifyGetSingleCounts<T>(cls, failOnMany, results, builder.where);
  }

  @Connected()
  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);
    return this.#dialect.getCountForQuery(cls, query);
  }

  @Connected()
  @Transactional()
  async updateByQuery<T extends ModelType>(cls: Class<T>, item: T, query: ModelQuery<T>): Promise<T> {
    await QueryVerifier.verify(cls, query);
    const where = ModelQueryUtil.getWhereClause(cls, query.where);
    where.id = item.id;
    await this.#deleteRaw(cls, item.id, where, true);
    return await this.create(cls, item);
  }

  @Connected()
  @Transactional()
  async updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);
    const item = await ModelCrudUtil.prePartialUpdate(cls, data);
    const { count } = await this.#exec(this.#dialect.getUpdateSQL(SQLModelUtil.classToStack(cls), item, ModelQueryUtil.getWhereClause(cls, query.where)));
    return count;
  }

  @Connected()
  @Transactional()
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    await QueryVerifier.verify(cls, query);
    const { count } = await this.#exec(this.#dialect.getDeleteSQL(SQLModelUtil.classToStack(cls), ModelQueryUtil.getWhereClause(cls, query.where, false)));
    return count;
  }

  @Connected()
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
    await QueryVerifier.verify(cls, query);
    const resolvedQuery = ModelQuerySuggestUtil.getSuggestQuery<T>(cls, field, prefix, query);
    const results = await this.query<T>(cls, resolvedQuery);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, field, prefix, results, (a, b) => b, query?.limit);
  }

  @Connected()
  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
    await QueryVerifier.verify(cls, query);
    const resolvedQuery = ModelQuerySuggestUtil.getSuggestFieldQuery(cls, field, prefix, query);
    const results = await this.query(cls, resolvedQuery);

    const modelTypeField: ValidStringFields<ModelType> = castTo(field);
    return ModelQuerySuggestUtil.combineSuggestResults(cls, modelTypeField, prefix, results, result => result, query?.limit);
  }

  @Connected()
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<ModelQueryFacet[]> {
    await QueryVerifier.verify(cls, query);
    const col = this.#dialect.identifier(field);
    const ttl = this.#dialect.identifier('count');
    const key = this.#dialect.identifier('key');
    const sql = [
      `SELECT ${col} as ${key}, COUNT(${col}) as ${ttl}`,
      this.#dialect.getFromSQL(cls),
    ];
    sql.push(
      this.#dialect.getWhereSQL(cls, ModelQueryUtil.getWhereClause(cls, query?.where))
    );
    sql.push(
      `GROUP BY ${col}`,
      `ORDER BY ${ttl} DESC`
    );

    const results = await this.#exec<{ key: string, count: number }>(sql.join('\n'));
    return results.records.map(result => {
      result.count = DataUtil.coerceType(result.count, Number);
      return result;
    });
  }
}