import { type ModelCrudProvider, ModelCrudUtil, type ModelType, NotFoundError } from '@travetto/model';
import { type ModelQuery, ModelQueryUtil, type PageableModelQuery, QueryVerifier } from '@travetto/model-query';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';

import type { SQLConnection } from '../connection.ts';
import type { SQLDialect } from '../dialect.ts';
import { SQLQueryCompiler } from '../query.ts';
import { SQLModelUtil } from '../util.ts';
import { SQLModelCrudUtil } from './crud.ts';

export class SQLModelQueryUtil {
  static async query<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    query: PageableModelQuery<T>
  ): Promise<T[]> {
    await QueryVerifier.verify(modelClass, query);
    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(
      dialect,
      context,
      ModelQueryUtil.getWhereClause(modelClass, query.where)
    );
    const sortSQL = SQLQueryCompiler.compileSort(dialect, context, query.sort);

    let pagination = '';
    if (query.limit !== undefined) {
      pagination += ` LIMIT ${query.limit}`;
    }
    if (query.offset !== undefined) {
      pagination += ` OFFSET ${query.offset}`;
    }

    const sql = `SELECT * FROM ${dialect.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} ${sortSQL} ${pagination};`;
    const result = await conn.execute(sql, parameters);

    return SQLModelCrudUtil.loadMany(modelClass, result.records);
  }

  static async queryOne<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    query: ModelQuery<T>,
    failOnMany = true
  ): Promise<T> {
    const limit = failOnMany ? 2 : 1;
    const items = await this.query<T>(conn, dialect, modelClass, { ...query, limit });
    return ModelQueryUtil.verifyGetSingleCounts<T>(modelClass, failOnMany, items, query.where);
  }

  static async queryCount<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    query: ModelQuery<T>
  ): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(
      dialect,
      context,
      ModelQueryUtil.getWhereClause(modelClass, query.where)
    );
    const sql = `SELECT COUNT(*) as "total" FROM ${dialect.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

    const result = await conn.execute<{ total: string | number }>(sql, parameters);
    return Number(result.records[0]?.total ?? 0);
  }

  static async updateByQuery<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    item: T,
    query: ModelQuery<T>,
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    await QueryVerifier.verify(modelClass, query);
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: ModelCrudUtil.uuidSource() });
    const rawItem: Record<string, unknown> = castTo(preppedItem);

    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(
      dialect,
      context,
      ModelQueryUtil.getWhereClause(modelClass, query.where)
    );

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${dialect.escapeIdentifier(field.name)} = ${dialect.getPlaceholder(values.length + 1)}`);
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      sets.push(`${dialect.escapeIdentifier(field.name)} = ${dialect.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const conditions = [`${dialect.escapeIdentifier('id')} = ${dialect.getPlaceholder(values.length + 1)}`];
    values.push(preppedItem.id);

    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = dialect.shiftPlaceholders ? dialect.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${dialect.escapeIdentifier(context.tableName)} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')};`;

    const result = await conn.execute(sql, values);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, `Query: ${JSONUtil.toUTF8(query.where)}`);
    }

    return preppedItem;
  }

  static async updatePartialByQuery<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    query: ModelQuery<T>,
    data: Partial<T>
  ): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const result = await SQLModelCrudUtil.executeUpdatePartial(conn, dialect, modelClass, query.where!, data, false);
    return result.count;
  }

  static async deleteByQuery<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    query: ModelQuery<T>
  ): Promise<number> {
    await QueryVerifier.verify(modelClass, query);
    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(
      dialect,
      context,
      ModelQueryUtil.getWhereClause(modelClass, query.where, false),
      false
    );

    const sql = `DELETE FROM ${dialect.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''};`;

    const result = await conn.execute(sql, parameters);
    return result.count;
  }
}
