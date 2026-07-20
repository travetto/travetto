import {
  type ModelCrudProvider,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelListOptions,
  type ModelType,
  NotFoundError,
  type OptionalId
} from '@travetto/model';
import {
  type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody,
  type KeyedIndexBody,
  type KeyedIndexSelection,
  ModelIndexedComputedIndex,
  type ModelIndexedSearchOptions,
  type ModelIndexedSupport,
  ModelIndexedUtil,
  type ModelPageOptions,
  type ModelPageResult,
  type SingleItemIndex,
  type SortedIndex,
  type SortedIndexSelection,
  type SortedIndexSelectionType
} from '@travetto/model-indexed';
import { ModelQueryUtil, type WhereClause } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';

import type { SQLConnection } from '../connection.ts';
import type { SQLDialect } from '../dialect.ts';
import { SQLQueryCompiler } from '../query.ts';
import { SQLModelUtil } from '../util.ts';
import { SQLModelCrudUtil } from './crud.ts';

export class SQLModelIndexedUtil {
  static validateIndexResult<T extends ModelType>(
    modelClass: Class<T>,
    result: { count: number },
    indexConfig: SingleItemIndex<T>,
    computed: ModelIndexedComputedIndex<T>
  ): void {
    if (result.count === 0) {
      throw new NotFoundError(`${modelClass.name} Index=${indexConfig}`, computed.getKey());
    }
    if (result.count > 1) {
      throw new Error(`Multiple items found for index lookup ${modelClass.name} Index=${indexConfig}`);
    }
  }

  static async getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, where));
    const sql = `SELECT * FROM ${dialect.escapeIdentifier(context.tableName)} WHERE ${whereSQL};`;

    const result = await conn.execute<Record<string, unknown>>(sql, parameters);
    this.validateIndexResult(modelClass, result, indexConfig, computed);

    return SQLModelCrudUtil.loadSingle(modelClass, result.records[0]);
  }

  static async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, where));
    const sql = `DELETE FROM ${dialect.escapeIdentifier(context.tableName)} WHERE ${whereSQL};`;

    const result = await conn.execute(sql, parameters);
    this.validateIndexResult(modelClass, result, indexConfig, computed);
  }

  static upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    modelSource: ModelIndexedSupport & ModelCrudSupport,
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(modelSource, modelClass, indexConfig, body);
  }

  static async updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: T,
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, castTo(body)).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const preppedItem = await SQLModelCrudUtil.executeUpdate(conn, dialect, modelClass, where, body, modelSource);
    if (!preppedItem) {
      throw new NotFoundError(`${modelClass.name} Index=${indexConfig}`, computed.getKey());
    }
    return preppedItem;
  }

  static async updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);

    const computed = ModelIndexedComputedIndex.get(indexConfig, castTo(body)).validate({ sort: true });
    const where: WhereClause<T> = castTo(computed.project({ sort: true, includeId: true }));

    const result = await SQLModelCrudUtil.executeUpdatePartial(conn, dialect, modelClass, where, castTo(body), true);
    this.validateIndexResult(modelClass, result, indexConfig, computed);

    return SQLModelCrudUtil.loadSingle(modelClass, result.records[0]);
  }

  static async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions & { offset?: number }
  ): AsyncIterable<T[]> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate();
    const where: WhereClause<T> = castTo(computed.project());

    const context = SQLModelUtil.getContext(dialect, modelClass);

    const sortClauses = indexConfig.sortTemplate.map(({ path, value }) => {
      const expression = dialect.compileIndexPath(context.tableName, context.simpleFields, path);
      return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
    });
    const sortSQL = sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, where));

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${dialect.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} LIMIT ${batchLimit} OFFSET ${offset};`;

      const result = await conn.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await SQLModelCrudUtil.loadMany(modelClass, result.records);
      yield items;
      produced += items.length;
      offset += items.length;
    }
  }

  static async pageByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions
  ): Promise<ModelPageResult<T>> {
    const listOptions = {
      limit: options?.limit,
      offset: options?.offset ? Number(options.offset) : 0
    };

    const items: T[] = [];
    let nextOffset = listOptions.offset ?? 0;

    for await (const batch of this.listByIndex(conn, dialect, modelClass, indexConfig, body, listOptions)) {
      items.push(...batch);
      nextOffset += batch.length;
    }

    return {
      items,
      nextOffset: items.length === options?.limit ? String(nextOffset) : undefined
    };
  }

  static async suggestByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
    B extends SortedIndexSelectionType<T, S> & string
  >(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    indexConfig: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    prefix: B,
    options?: ModelIndexedSearchOptions
  ): Promise<T[]> {
    const computed = ModelIndexedComputedIndex.get(indexConfig, body).validate();
    const where: WhereClause<T> = castTo(computed.project());

    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, where));

    const prefixFieldPath = indexConfig.sortTemplate[0].path;
    const { sqlPath } = SQLQueryCompiler.resolvePath(dialect, context, prefixFieldPath);

    const placeholder = dialect.getPlaceholder(parameters.length + 1);
    parameters.push(`${prefix}%`);

    const likeOp = dialect.suggestLikeOperator ?? 'LIKE';
    const conditions = [`${sqlPath} ${likeOp} ${placeholder}`];
    if (whereSQL) {
      conditions.push(whereSQL);
    }

    const sql = `SELECT * FROM ${dialect.escapeIdentifier(context.tableName)} WHERE ${conditions.join(' AND ')} LIMIT ${options?.limit ?? 10};`;
    const result = await conn.execute(sql, parameters);

    return SQLModelCrudUtil.loadMany(modelClass, result.records);
  }
}
