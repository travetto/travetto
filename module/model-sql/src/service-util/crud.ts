import {
  type ModelCrudProvider,
  ModelCrudUtil,
  type ModelListOptions,
  type ModelType,
  NotFoundError,
  type OptionalId
} from '@travetto/model';
import { ModelQueryUtil, type WhereClause } from '@travetto/model-query';
import { type Class, castTo, JSONUtil } from '@travetto/runtime';

import type { SQLConnection } from '../connection.ts';
import type { SQLDialect } from '../dialect.ts';
import { SQLQueryCompiler, type TableContext } from '../query.ts';
import { SQLModelUtil } from '../util.ts';

export class SQLModelCrudUtil {
  static loadSingle<T extends ModelType>(modelClass: Class<T>, record: Record<string, unknown>): Promise<T> {
    return ModelCrudUtil.load(modelClass, record);
  }

  static loadMany<T extends ModelType>(modelClass: Class<T>, records: unknown[]): Promise<T[]> {
    return Promise.all(records.map(row => ModelCrudUtil.load(modelClass, castTo(row))));
  }

  static compilePartialUpdate<T extends ModelType>(
    dialect: SQLDialect,
    context: TableContext<T>,
    preparedData: Partial<T>
  ): { sets: string[]; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [fieldName, val] of Object.entries(preparedData)) {
      const simpleField = context.simpleFields.get(fieldName);
      if (simpleField) {
        sets.push(`${dialect.escapeIdentifier(fieldName)} = ${dialect.getPlaceholder(values.length + 1)}`);
        values.push(val === undefined || val === null ? null : val);
        continue;
      }

      const complexField = context.complexFields.get(fieldName);
      if (complexField) {
        sets.push(`${dialect.escapeIdentifier(fieldName)} = ${dialect.getPlaceholder(values.length + 1)}`);
        values.push(val !== undefined && val !== null ? JSONUtil.toUTF8(val) : null);
      }
    }
    return { sets, values };
  }

  static async executeUpdatePartial<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    where: WhereClause<T>,
    data: Partial<T>,
    returning: boolean,
    view?: string
  ): Promise<{ count: number; records: Record<string, unknown>[] }> {
    const preparedData = await ModelCrudUtil.prePartialUpdate(modelClass, data, view);

    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { sets, values } = this.compilePartialUpdate(dialect, context, preparedData);
    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, where));

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = dialect.shiftPlaceholders ? dialect.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${dialect.escapeIdentifier(context.tableName)} SET ${sets.join(', ')} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}${returning ? ' RETURNING *' : ''};`;

    return await conn.execute<Record<string, unknown>>(sql, values);
  }

  static async executeUpdate<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    where: WhereClause<T>,
    item: T,
    modelSource?: ModelCrudProvider
  ): Promise<T | undefined> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: ModelCrudUtil.uuidSource() });
    const rawItem: Record<string, unknown> = castTo(preppedItem);

    const context = SQLModelUtil.getContext(dialect, modelClass);
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

    const { whereSQL, parameters = [] } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, where));

    const conditions: string[] = [];
    if (whereSQL) {
      const offset = values.length;
      const shiftedWhereSQL = dialect.shiftPlaceholders ? dialect.shiftPlaceholders(whereSQL, offset) : whereSQL;
      conditions.push(shiftedWhereSQL);
      values.push(...parameters);
    }

    const sql = `UPDATE ${dialect.escapeIdentifier(context.tableName)} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`;

    const result = await conn.execute(sql, values);
    if (result.count === 0) {
      return undefined;
    }
    if (result.count > 1) {
      throw new Error(`Multiple items found for update lookup ${modelClass.name}`);
    }
    return preppedItem;
  }

  static async executeUpsert<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    item: OptionalId<T>,
    conflictTarget: string[],
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: ModelCrudUtil.uuidSource() });
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const context = SQLModelUtil.getContext(dialect, modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];
    const updates: string[] = [];

    for (const field of context.simpleFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
      if (field.name !== 'id') {
        updates.push(`${dialect.escapeIdentifier(field.name)} = EXCLUDED.${dialect.escapeIdentifier(field.name)}`);
      }
    }

    for (const field of context.complexFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
      updates.push(`${dialect.escapeIdentifier(field.name)} = EXCLUDED.${dialect.escapeIdentifier(field.name)}`);
    }

    const placeholders = columns.map((_, index) => dialect.getPlaceholder(index + 1));
    const sql = dialect.getUpsertSQL(context.tableName, columns, placeholders, conflictTarget, updates);

    const result = await conn.execute<Record<string, unknown>>(sql, values);
    if (result.records.length > 0) {
      return this.loadSingle(modelClass, result.records[0]);
    } else {
      return this.get(conn, dialect, modelClass, rawItem.id as string);
    }
  }

  static async get<T extends ModelType>(conn: SQLConnection, dialect: SQLDialect, modelClass: Class<T>, id: string): Promise<T> {
    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(
      dialect,
      context,
      ModelQueryUtil.getWhereClause(modelClass, castTo({ id }))
    );
    const sql = `SELECT * FROM ${dialect.escapeIdentifier(context.tableName)} WHERE ${whereSQL};`;

    const result = await conn.execute<Record<string, unknown>>(sql, parameters);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }

    return this.loadSingle(modelClass, result.records[0]);
  }

  static async create<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    item: OptionalId<T>,
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    const preppedItem = await ModelCrudUtil.preStore(modelClass, item, modelSource ?? { idSource: ModelCrudUtil.uuidSource() });
    const rawItem: Record<string, unknown> = castTo(preppedItem);
    const context = SQLModelUtil.getContext(dialect, modelClass);

    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of context.simpleFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const val = rawItem[field.name];
      values.push(val === undefined || val === null ? null : val);
    }

    for (const field of context.complexFields.values()) {
      columns.push(dialect.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value !== undefined && value !== null ? JSONUtil.toUTF8(value) : null);
    }

    const placeholders = columns.map((_, index) => dialect.getPlaceholder(index + 1));
    const sql = `INSERT INTO ${dialect.escapeIdentifier(context.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`;

    await conn.execute(sql, values);
    return preppedItem;
  }

  static async update<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    item: T,
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    const preppedItem = await this.executeUpdate(conn, dialect, modelClass, castTo({ id: item.id }), item, modelSource);
    if (!preppedItem) {
      throw new NotFoundError(modelClass, item.id);
    }
    return preppedItem;
  }

  static async upsert<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    item: OptionalId<T>,
    modelSource?: ModelCrudProvider
  ): Promise<T> {
    return this.executeUpsert(conn, dialect, modelClass, item, [dialect.escapeIdentifier('id')], modelSource);
  }

  static async updatePartial<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    item: Partial<T> & { id: string },
    view?: string
  ): Promise<T> {
    ModelCrudUtil.ensureNotSubType(modelClass);

    const result = await this.executeUpdatePartial(conn, dialect, modelClass, castTo({ id: item.id }), item, true, view);

    if (result.count === 0) {
      throw new NotFoundError(modelClass, item.id);
    }

    return this.loadSingle(modelClass, result.records[0]);
  }

  static async delete<T extends ModelType>(conn: SQLConnection, dialect: SQLDialect, modelClass: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(modelClass);
    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(
      dialect,
      context,
      ModelQueryUtil.getWhereClause(modelClass, castTo({ id }), false)
    );
    const sql = `DELETE FROM ${dialect.escapeIdentifier(context.tableName)} WHERE ${whereSQL};`;

    const result = await conn.execute(sql, parameters);
    if (result.count === 0) {
      throw new NotFoundError(modelClass, id);
    }
  }

  static async *list<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    yield* this.listWithOffset(conn, dialect, modelClass, options);
  }

  static async *listWithOffset<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    options?: ModelListOptions & { offset?: number }
  ): AsyncIterable<T[]> {
    const context = SQLModelUtil.getContext(dialect, modelClass);
    const { whereSQL, parameters } = SQLQueryCompiler.compileWhere(dialect, context, ModelQueryUtil.getWhereClause(modelClass, undefined));

    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    const batchSize = Math.min(options?.batchSizeHint ?? 100, limit);

    let offset = options?.offset ?? 0;
    let produced = 0;

    while (!options?.abort?.aborted && produced < limit) {
      const batchLimit = Math.min(batchSize, limit - produced);
      const sql = `SELECT * FROM ${dialect.escapeIdentifier(context.tableName)} ${whereSQL ? `WHERE ${whereSQL}` : ''} LIMIT ${batchLimit} OFFSET ${offset};`;

      const result = await conn.execute(sql, parameters);
      if (result.count === 0) {
        break;
      }

      const items = await this.loadMany(modelClass, result.records);
      yield items;
      produced += items.length;
      offset += items.length;
    }
  }
}
