import type { IndexConfig, ModelType } from '@travetto/model';
import { ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { isModelQueryIndex, ModelQueryUtil, type SortClause, type WhereClause } from '@travetto/model-query';
import { type Class, castTo, JSONUtil, RuntimeError } from '@travetto/runtime';
import { DataUtil, type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { JSONSqlPathMode, SchemaContext, TableContext } from './types.ts';

export interface TransactionStatements {
  begin: string;
  beginNested: string;
  isolate: string;
  rollback: string;
  rollbackNested: string;
  commit: string;
  commitNested: string;
}

interface QueryClause {
  sql?: string;
  parameters?: Record<string, unknown>;
}

type IdentificationPath = string;

/**
 * Abstract ANSI SQL-99 Dialect base implementation.
 * Pure SQL text generator and query builder (does not execute queries or hold connection state).
 */
export abstract class AbstractANSI99Dialect {
  static TRANSACTION_STATEMENTS: TransactionStatements = {
    begin: 'BEGIN;',
    beginNested: 'SAVEPOINT $1;',
    isolate: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
    rollback: 'ROLLBACK;',
    rollbackNested: 'ROLLBACK TO $1;',
    commit: 'COMMIT;',
    commitNested: 'RELEASE SAVEPOINT $1;'
  };

  static SCHEMA_CACHE = new Map<Class, SchemaContext<unknown>>();

  returningSupport = false;
  suggestLikeOperator = 'LIKE';
  transactionStatements: TransactionStatements = AbstractANSI99Dialect.TRANSACTION_STATEMENTS;
  abstract getComplexColumnType(field: SchemaFieldConfig): string;

  getComplexColumnValue(field: SchemaFieldConfig, value: unknown): unknown {
    return value === null || value === undefined ? null : JSONUtil.toUTF8(value);
  }

  escapeIdentifier(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
  }

  escapeLiteral(value: string): string {
    return value.replaceAll("'", "''");
  }

  getPlaceholder(index: number): string {
    return '?';
  }

  abstract getColumnType(fieldConfiguration: SchemaFieldConfig): string;
  abstract compileJsonIndexPath(columnName: string, jsonPath: string[], mode: JSONSqlPathMode): string;
  abstract compileArrayContains(x: string, identifier: string, isObject: boolean, field: SchemaFieldConfig): string;
  abstract getRegexOperator(caseInsensitive: boolean): string;
  abstract formatRegex(source: string, caseInsensitive: boolean): string;
  abstract castColumn(sqlPath: string, type: Class): string;

  compileJsonEquality?(sqlPath: string, identifier: string): string;
  shiftPlaceholders?(whereSQL: string, offset: number): string;

  compileIndexPath(context: TableContext, path: string[], mode: JSONSqlPathMode): string {
    const firstSegment = path[0];
    const escapedFirst = this.escapeIdentifier(firstSegment);
    if (context.simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new RuntimeError(`Cannot create nested index under column "${firstSegment}" in table "${context.tableName}"`);
      }
      return escapedFirst;
    } else {
      const nestedSegments = path.slice(1);
      if (nestedSegments.length === 0) {
        return escapedFirst;
      }
      return this.compileJsonIndexPath(escapedFirst, nestedSegments, mode);
    }
  }

  getCreateIndexSQL(context: TableContext, indexConfig: IndexConfig): string {
    const { tableName, cls: modelClass } = context;
    const indexName = ['idx', tableName, indexConfig.name.toLowerCase().replaceAll('-', '_')].join('_');

    if (isModelQueryIndex(indexConfig)) {
      const indexFields = indexConfig.fields.map(field => {
        const fieldKey = Object.keys(field)[0];
        const sortDirection = castTo<Record<string, unknown>>(field)[fieldKey];
        const isAscending = typeof sortDirection === 'number' ? sortDirection === 1 : !sortDirection;

        const path = fieldKey.split('.');
        const expression = this.compileIndexPath(context, path, 'createIndex');
        return `${expression} ${isAscending ? 'ASC' : 'DESC'}`;
      });

      return `CREATE ${indexConfig.unique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(context.tableName)} (${indexFields.join(', ')});`;
    } else if (isModelIndexedIndex(indexConfig)) {
      const allFields = [...indexConfig.keyTemplate, ...indexConfig.sortTemplate];
      const indexFields = allFields.map(({ path, value }) => {
        const expression = this.compileIndexPath(context, path, 'createIndex');
        return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
      });

      const isUnique = 'unique' in indexConfig && indexConfig.unique;
      return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(context.tableName)} (${indexFields.join(', ')});`;
    }

    throw new RuntimeError(`Unsupported index configuration for class ${modelClass.name}`);
  }

  getCreateTableSQL(context: TableContext): string {
    const idType = this.getColumnType(castTo({ name: 'id', type: String }));
    const columnDefinitions: string[] = [`${this.escapeIdentifier('id')} ${idType} PRIMARY KEY`];

    for (const field of context.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      const columnType = this.getColumnType(field);
      columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${columnType}`);
    }

    for (const field of context.complexFields.values()) {
      columnDefinitions.push(`${this.escapeIdentifier(field.name)} ${this.getComplexColumnType(field)}`);
    }

    return `
CREATE TABLE ${this.escapeIdentifier(context.tableName)} (
  ${columnDefinitions.join(',\n  ')}
);
`.trim();
  }

  getCreateTableIndexSQLs(context: TableContext): string[] {
    const indexes = ModelRegistryIndex.getIndices(context.cls) || [];
    return indexes.map(indexConfig => this.getCreateIndexSQL(context, indexConfig));
  }

  getAddColumnSQL(context: TableContext, columnName: string, columnType: string): string {
    return `ALTER TABLE ${this.escapeIdentifier(context.tableName)} ADD COLUMN ${this.escapeIdentifier(columnName)} ${columnType};`;
  }

  getUpsertSQL(context: TableContext, columns: string[], placeholders: string[], conflictTarget: string[], updates: string[]): string {
    return `INSERT INTO ${this.escapeIdentifier(context.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING *;`;
  }

  normalizeIndexDefinition(sql: string): string {
    return sql
      .toLowerCase()
      .replaceAll('"', '')
      .replaceAll("'", '')
      .replaceAll(' ', '')
      .replaceAll('asc', '')
      .replaceAll('desc', '')
      .replaceAll('btree', '')
      .replaceAll('public.', '')
      .replaceAll('::text', '')
      .replaceAll('(', '')
      .replaceAll(')', '');
  }

  abstract getTableExistsQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  abstract parseTableExistsResult(records: unknown[]): boolean;
  abstract getExistingColumnsQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  abstract parseExistingColumns(records: unknown[]): Map<string, string>;
  abstract getExistingIndexesQuery(context: TableContext): { sql: string; parameters?: unknown[] };
  abstract parseExistingIndexes(records: unknown[]): Map<string, string>;

  getDropIndexSQL(context: TableContext, indexName: string): string {
    return `DROP INDEX ${this.escapeIdentifier(indexName)} ON ${this.escapeIdentifier(context.tableName)};`;
  }

  getDropTableSQL(context: TableContext): string {
    return `DROP TABLE IF EXISTS ${this.escapeIdentifier(context.tableName)};`;
  }

  getTruncateTableSQL(context: TableContext): string {
    return `TRUNCATE TABLE ${this.escapeIdentifier(context.tableName)};`;
  }

  getAlterColumnTypeSQL?(context: TableContext, columnName: string, columnType: string, existingType: string): string | undefined;

  // Query Compilation
  static #combineResults(results: QueryClause[], operator: string): QueryClause {
    const filtered = results.filter(result => !!result.sql);

    if (filtered.length === 0) {
      return {};
    } else if (filtered.length === 1) {
      return filtered[0];
    } else {
      const fullOperator = ` ${operator} `;
      return {
        sql: `(${filtered.map(result => result.sql).join(fullOperator)})`,
        parameters: Object.assign({}, ...results.map(result => result.parameters))
      };
    }
  }

  compileWhere<T extends ModelType>(
    tableContext: TableContext<T>,
    where?: WhereClause<T>,
    checkExpiry = true
  ): {
    whereSQL?: string;
    parameters?: unknown[];
  } {
    const resolvedWhere = ModelQueryUtil.getWhereClause(tableContext.cls, where, checkExpiry);
    const compiled = this.#compileClause(tableContext, resolvedWhere);
    if (Object.entries(compiled.parameters ?? {}).length) {
      const parameters: unknown[] = [];
      const seen = new Map<string, string>();
      const sql = compiled
        .sql!.replace(/%%([^%]{0,200})%%/g, key => {
          if (!seen.has(key)) {
            parameters.push(compiled.parameters![key]);
            seen.set(key, this.getPlaceholder(parameters.length));
          }
          return seen.get(key)!;
        })
        .trim();
      return { whereSQL: sql, parameters };
    } else {
      return { whereSQL: compiled.sql?.trim() };
    }
  }

  compileSort<T extends ModelType>(tableContext: TableContext<T>, sort?: SortClause<T>[]): string {
    if (!sort || sort.length === 0) {
      return '';
    }
    const sortClauses = sort.map(sortClause => {
      const key = Object.keys(sortClause)[0];
      const direction = castTo<Record<string, 1 | -1>>(sortClause)[key];
      const path = key.split('.');
      const { sqlPath } = this.resolvePath(tableContext, path, 'orderBy');
      return `${sqlPath} ${direction === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }

  resolvePath<T extends ModelType>(
    tableContext: TableContext<T>,
    path: string[],
    mode: JSONSqlPathMode
  ): { sqlPath: string; leafField?: SchemaFieldConfig } {
    const firstSegment = path[0];

    if (tableContext.simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new RuntimeError(
          `Cannot traverse nested properties under simple column "${firstSegment}" in table "${tableContext.tableName}"`,
          {
            category: 'data'
          }
        );
      }
      const leafField = tableContext.simpleFields.get(firstSegment);
      return { sqlPath: this.escapeIdentifier(firstSegment), leafField };
    }

    let currentField: SchemaFieldConfig | undefined = tableContext.complexFields.get(firstSegment);
    let currentClass = currentField?.type;
    const jsonPath = path.slice(1);

    for (let index = 0; index < jsonPath.length - 1; index++) {
      const segment = jsonPath[index];
      const subclassConfiguration = SchemaRegistryIndex.getOptional(currentClass!)?.get();
      currentField = subclassConfiguration?.fields[segment];
      currentClass = currentField?.type;
    }

    if (jsonPath.length > 0) {
      const leafSegment = jsonPath[jsonPath.length - 1];
      const subclassConfiguration = SchemaRegistryIndex.getOptional(currentClass!)?.get();
      currentField = subclassConfiguration?.fields[leafSegment];
    }

    let compiledPath = this.compileIndexPath(tableContext, path, mode);

    if (currentField && !currentField.array) {
      compiledPath = this.castColumn(compiledPath, currentField.type);
    }

    return { sqlPath: compiledPath, leafField: currentField };
  }

  #compileClause<T extends ModelType>(
    tableContext: TableContext<T>,
    clause: WhereClause<T>,
    identificationPath: IdentificationPath = ''
  ): QueryClause {
    if (!clause) {
      return {};
    }
    if (ModelQueryUtil.has$And(clause)) {
      const compiled = clause.$and
        .map((item, index) => this.#compileClause(tableContext, item, `${identificationPath}_${index}`))
        .filter(Boolean);
      return AbstractANSI99Dialect.#combineResults(compiled, 'AND');
    } else if (ModelQueryUtil.has$Or(clause)) {
      const compiled = clause.$or
        .map((item, index) => this.#compileClause(tableContext, item, `${identificationPath}_${index}`))
        .filter(Boolean);
      return AbstractANSI99Dialect.#combineResults(compiled, 'OR');
    } else if (ModelQueryUtil.has$Not(clause)) {
      const compiled = this.#compileClause(tableContext, clause.$not, identificationPath);
      return compiled
        ? {
            sql: `NOT (${compiled.sql})`,
            parameters: compiled.parameters
          }
        : {};
    } else {
      return this.#compileSimple(tableContext, clause, [], identificationPath);
    }
  }

  #buildJsonTemplate(queryObject: Record<string, unknown>): Record<string, unknown> {
    const template: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(queryObject)) {
      if (DataUtil.isPlainObject(value)) {
        const firstKey = Object.keys(value)[0];
        const valueObject = castTo<Record<string, unknown>>(value);
        if (firstKey === '$eq') {
          template[key] = valueObject.$eq;
        } else if (valueObject.$eq !== undefined) {
          template[key] = valueObject.$eq;
        } else if (!firstKey.startsWith('$')) {
          template[key] = this.#buildJsonTemplate(valueObject);
        } else {
          throw new RuntimeError(`Unsupported operator ${firstKey} in nested array query`, { category: 'data' });
        }
      } else {
        template[key] = value;
      }
    }
    return template;
  }

  #compileSimple<T extends ModelType>(
    tableContext: TableContext<T>,
    item: Record<string, unknown>,
    parentPath: string[] = [],
    identificationPath: IdentificationPath = ''
  ): QueryClause {
    if (!item) {
      return {};
    }
    const clauses: QueryClause[] = [];

    let index = 0;
    for (const [key, value] of Object.entries(item)) {
      index += 1;
      const currentPath = [...parentPath, key];
      const isPlainObject = DataUtil.isPlainObject(value);
      const firstKey = isPlainObject ? Object.keys(value)[0] : '';

      const { sqlPath, leafField } = this.resolvePath(tableContext, currentPath, 'read');
      const nextIdentificationPath = `${identificationPath}__${index}`;

      if (leafField?.array && SchemaRegistryIndex.has(leafField.type) && isPlainObject && !firstKey.startsWith('$')) {
        const template = this.#buildJsonTemplate(value as Record<string, unknown>);
        const identifier = `%%${nextIdentificationPath}%%`;
        clauses.push({
          sql: this.compileArrayContains(sqlPath, identifier, true, leafField),
          parameters: {
            [identifier]: JSONUtil.toUTF8([template])
          }
        });
      } else if (isPlainObject && firstKey.startsWith('$')) {
        clauses.push(this.#compileOperator(tableContext, currentPath, value as Record<string, unknown>, nextIdentificationPath));
      } else if (isPlainObject) {
        clauses.push(this.#compileSimple(tableContext, value as Record<string, unknown>, currentPath, nextIdentificationPath));
      } else {
        clauses.push(this.#compileOperator(tableContext, currentPath, { $eq: value }, nextIdentificationPath));
      }
    }

    return AbstractANSI99Dialect.#combineResults(clauses, 'AND');
  }

  #compileOperator<T extends ModelType>(
    tableContext: TableContext<T>,
    path: string[],
    operation: Record<string, unknown>,
    identificationPath: IdentificationPath = ''
  ): QueryClause {
    const { sqlPath, leafField } = this.resolvePath(tableContext, path, 'read');
    const clauses: QueryClause[] = [];

    let index = 0;
    for (let [operator, value] of Object.entries(operation)) {
      index += 1;

      if (Array.isArray(value)) {
        value = value.map(valueItem => ModelQueryUtil.resolveComparator(valueItem));
      } else {
        value = ModelQueryUtil.resolveComparator(value);
      }

      const nestedIdentificationPath = `${identificationPath}_${index}`;
      const identifier = `%%${nestedIdentificationPath}%%`;

      let clause: QueryClause;

      if (leafField?.array) {
        const isObject = typeof value === 'object' && value !== null;
        if (operator === '$eq') {
          const formatted = isObject ? JSONUtil.toUTF8(value) : value;
          clause = {
            parameters: { [identifier]: formatted },
            sql: this.compileArrayContains(sqlPath, identifier, isObject, leafField)
          };
        } else if (operator === '$ne') {
          const formatted = isObject ? JSONUtil.toUTF8(value) : value;
          clause = {
            parameters: { [identifier]: formatted },
            sql: `NOT (${this.compileArrayContains(sqlPath, identifier, isObject, leafField)})`
          };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((valueItem, itemIndex) => {
              const innerIdentifier = `%%${nestedIdentificationPath}_${itemIndex}%%`;
              const innerIsObject = typeof valueItem === 'object' && valueItem !== null;
              const formattedVal = innerIsObject ? JSONUtil.toUTF8(valueItem) : valueItem;
              return {
                sql: this.compileArrayContains(sqlPath, innerIdentifier, innerIsObject, leafField),
                parameters: { [innerIdentifier]: formattedVal }
              };
            });
            clause = AbstractANSI99Dialect.#combineResults(choices, 'OR');
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const choices = value.map((valueItem, itemIndex) => {
              const innerIdentifier = `%%${nestedIdentificationPath}_${itemIndex}%%`;
              const innerIsObject = typeof valueItem === 'object' && valueItem !== null;
              const formattedVal = innerIsObject ? JSONUtil.toUTF8(valueItem) : valueItem;
              return {
                sql: `NOT (${this.compileArrayContains(sqlPath, innerIdentifier, innerIsObject, leafField)})`,
                parameters: { [innerIdentifier]: formattedVal }
              };
            });
            clause = AbstractANSI99Dialect.#combineResults(choices, 'AND');
          }
        } else if (operator === '$all') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((valueItem, itemIndex) => {
              const innerIdentifier = `%%${nestedIdentificationPath}_${itemIndex}%%`;
              const innerIsObject = typeof valueItem === 'object' && valueItem !== null;
              const formattedVal = innerIsObject ? JSONUtil.toUTF8(valueItem) : valueItem;
              return {
                sql: this.compileArrayContains(sqlPath, innerIdentifier, innerIsObject, leafField),
                parameters: { [innerIdentifier]: formattedVal }
              };
            });
            clause = AbstractANSI99Dialect.#combineResults(choices, 'AND');
          }
        } else if (operator === '$exists') {
          const emptyArrayStr = JSONUtil.toUTF8([]);
          const isNull = `${sqlPath} IS NULL`;
          const isEmpty = this.compileJsonEquality?.(sqlPath, identifier) ?? `${sqlPath} = ${identifier}`;
          if (value) {
            clause = {
              parameters: { [identifier]: emptyArrayStr },
              sql: `NOT (${isNull} OR ${isEmpty})`
            };
          } else {
            clause = {
              parameters: { [identifier]: emptyArrayStr },
              sql: `(${isNull} OR ${isEmpty})`
            };
          }
        } else {
          throw new RuntimeError(`Operator "${operator}" is not supported for arrays`, { category: 'data' });
        }
      } else {
        if (operator === '$eq') {
          if (value === null || value === undefined) {
            clause = { sql: `${sqlPath} IS NULL` };
          } else {
            clause = {
              sql: `${sqlPath} = ${identifier}`,
              parameters: { [identifier]: value }
            };
          }
        } else if (operator === '$ne') {
          if (value === null || value === undefined) {
            clause = { sql: `${sqlPath} IS NOT NULL` };
          } else {
            clause = {
              sql: `${sqlPath} <> ${identifier}`,
              parameters: { [identifier]: value }
            };
          }
        } else if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
          const sqlOperator = operator === '$gt' ? '>' : operator === '$gte' ? '>=' : operator === '$lt' ? '<' : '<=';
          clause = {
            sql: `${sqlPath} ${sqlOperator} ${identifier}`,
            parameters: { [identifier]: value }
          };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((valueItem, itemIndex) => {
              const innerIdentifier = `%%${nestedIdentificationPath}_${itemIndex}%%`;
              return [innerIdentifier, valueItem];
            });
            clause = {
              sql: `${sqlPath} IN (${choices.map(choice => choice[0]).join(', ')})`,
              parameters: Object.fromEntries(choices)
            };
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const choices = value.map((valueItem, itemIndex) => {
              const innerIdentifier = `%%${nestedIdentificationPath}_${itemIndex}%%`;
              return [innerIdentifier, valueItem];
            });
            clause = {
              sql: `${sqlPath} NOT IN (${choices.map(choice => choice[0]).join(', ')})`,
              parameters: Object.fromEntries(choices)
            };
          }
        } else if (operator === '$exists') {
          clause = { sql: value ? `${sqlPath} IS NOT NULL` : `${sqlPath} IS NULL` };
        } else if (operator === '$regex') {
          const regex = value instanceof RegExp ? value : new RegExp(String(value));
          const caseInsensitive = regex.flags.includes('i');
          const regexOp = this.getRegexOperator(caseInsensitive);
          const regexSource = this.formatRegex(regex.source, caseInsensitive);
          clause = {
            parameters: { [identifier]: regexSource },
            sql: `${sqlPath} ${regexOp} ${identifier}`
          };
        } else {
          throw new RuntimeError(`Operator "${operator}" is not supported for scalar columns`, { category: 'data' });
        }
      }

      if (clause) {
        clauses.push(clause);
      }
    }
    return AbstractANSI99Dialect.#combineResults(clauses, 'AND');
  }

  // Statement Builders
  buildInsert<T extends ModelType>(tableContext: TableContext<T>, rawItem: Record<string, unknown>): { sql: string; values: unknown[] } {
    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of tableContext.simpleFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value === undefined || value === null ? null : value);
    }

    for (const field of tableContext.complexFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(this.getComplexColumnValue(field, value));
    }

    const placeholders = columns.map((_, index) => this.getPlaceholder(index + 1));
    const sql = `INSERT INTO ${this.escapeIdentifier(tableContext.tableName)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`;

    return { sql, values };
  }

  buildUpdate<T extends ModelType>(
    tableContext: TableContext<T>,
    rawItem: Record<string, unknown>,
    whereSQL?: string,
    whereParameters: unknown[] = []
  ): { sql: string; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of tableContext.simpleFields.values()) {
      if (field.name === 'id') {
        continue;
      }
      sets.push(`${this.escapeIdentifier(field.name)} = ${this.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(value === undefined || value === null ? null : value);
    }

    for (const field of tableContext.complexFields.values()) {
      sets.push(`${this.escapeIdentifier(field.name)} = ${this.getPlaceholder(values.length + 1)}`);
      const value = rawItem[field.name];
      values.push(this.getComplexColumnValue(field, value));
    }

    const shiftedWhereSQL = whereSQL && this.shiftPlaceholders ? this.shiftPlaceholders(whereSQL, values.length) : whereSQL;
    if (whereSQL) {
      values.push(...whereParameters);
    }

    const sql = `UPDATE ${this.escapeIdentifier(tableContext.tableName)} SET ${sets.join(', ')}${shiftedWhereSQL ? ` WHERE ${shiftedWhereSQL}` : ''};`;
    return { sql, values };
  }

  compilePartialUpdate<T extends ModelType>(
    tableContext: TableContext<T>,
    preparedData: Partial<T>
  ): { sets: string[]; values: unknown[] } {
    const { sql, values } = this.buildPartialUpdate(tableContext, preparedData);
    const setMatch = sql.match(/SET (.*?)(\s+WHERE|$)/);
    const sets = setMatch ? setMatch[1].split(', ') : [];
    return { sets, values };
  }

  buildPartialUpdate<T extends ModelType>(
    tableContext: TableContext<T>,
    preparedData: Partial<T>,
    whereSQL?: string,
    whereParameters: unknown[] = [],
    returning = false
  ): { sql: string; values: unknown[] } {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [fieldName, value] of Object.entries(preparedData)) {
      const simpleField = tableContext.simpleFields.get(fieldName);
      if (simpleField) {
        sets.push(`${this.escapeIdentifier(fieldName)} = ${this.getPlaceholder(values.length + 1)}`);
        values.push(value === undefined || value === null ? null : value);
        continue;
      }

      const complexField = tableContext.complexFields.get(fieldName);
      if (complexField) {
        sets.push(`${this.escapeIdentifier(fieldName)} = ${this.getPlaceholder(values.length + 1)}`);
        values.push(this.getComplexColumnValue(complexField, value));
      }
    }

    const shiftedWhereSQL = whereSQL && this.shiftPlaceholders ? this.shiftPlaceholders(whereSQL, values.length) : whereSQL;
    if (whereSQL) {
      values.push(...whereParameters);
    }

    const returningClause = returning && this.returningSupport ? ' RETURNING *' : '';
    const sql = `UPDATE ${this.escapeIdentifier(tableContext.tableName)} SET ${sets.join(', ')}${shiftedWhereSQL ? ` WHERE ${shiftedWhereSQL}` : ''}${returningClause};`;

    return { sql, values };
  }

  buildUpsert<T extends ModelType>(
    tableContext: TableContext<T>,
    rawItem: Record<string, unknown>,
    conflictTarget: string[]
  ): { sql: string; values: unknown[] } {
    const columns: string[] = [];
    const values: unknown[] = [];
    const updates: string[] = [];

    for (const field of tableContext.simpleFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(value === undefined || value === null ? null : value);
      if (field.name !== 'id') {
        updates.push(`${this.escapeIdentifier(field.name)} = EXCLUDED.${this.escapeIdentifier(field.name)}`);
      }
    }

    for (const field of tableContext.complexFields.values()) {
      columns.push(this.escapeIdentifier(field.name));
      const value = rawItem[field.name];
      values.push(this.getComplexColumnValue(field, value));
      updates.push(`${this.escapeIdentifier(field.name)} = EXCLUDED.${this.escapeIdentifier(field.name)}`);
    }

    const placeholders = columns.map((_, index) => this.getPlaceholder(index + 1));
    const sql = this.getUpsertSQL(tableContext, columns, placeholders, conflictTarget, updates);

    return { sql, values };
  }

  buildSelect<T extends ModelType>(
    tableContext: TableContext<T>,
    options?: {
      whereSQL?: string;
      sortSQL?: string;
      limit?: number;
      offset?: number | string;
      columns?: string[];
    }
  ): string {
    const selectedColumns = options?.columns && options.columns.length > 0 ? options.columns.join(', ') : '*';
    const where = options?.whereSQL ? ` WHERE ${options.whereSQL}` : '';
    const sort = options?.sortSQL ? ` ${options.sortSQL}` : '';
    const limit = options?.limit !== undefined ? ` LIMIT ${options.limit}` : '';
    const offset = options?.offset !== undefined ? ` OFFSET ${options.offset}` : '';

    return `SELECT ${selectedColumns} FROM ${this.escapeIdentifier(tableContext.tableName)}${where}${sort}${limit}${offset};`;
  }

  buildDelete<T extends ModelType>(tableContext: TableContext<T>, whereSQL?: string): string {
    return `DELETE FROM ${this.escapeIdentifier(tableContext.tableName)}${whereSQL ? ` WHERE ${whereSQL}` : ''};`;
  }

  buildCount<T extends ModelType>(tableContext: TableContext<T>, whereSQL?: string): string {
    return `SELECT COUNT(*) as ${this.escapeIdentifier('total')} FROM ${this.escapeIdentifier(tableContext.tableName)}${whereSQL ? ` WHERE ${whereSQL}` : ''};`;
  }

  buildIndexSort<T extends ModelType>(
    tableContext: TableContext<T>,
    indexConfig: { sortTemplate: { path: string[]; value: number }[] }
  ): string {
    const sortClauses = indexConfig.sortTemplate.map(({ path, value }) => {
      const expression = this.compileIndexPath(tableContext, path, 'orderBy');
      return `${expression} ${value === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }

  buildFacet<T extends ModelType>(tableContext: TableContext<T>, sqlPath: string, whereSQL?: string): string {
    const keySql = this.castColumn?.(sqlPath, String) ?? sqlPath;
    const countSql = this.castColumn?.('COUNT(*)', Number) ?? 'COUNT(*)';
    const where = whereSQL ? ` AND ${whereSQL}` : '';

    return `SELECT ${keySql} AS ${this.escapeIdentifier('key')}, ${countSql} AS ${this.escapeIdentifier('count')} FROM ${this.escapeIdentifier(tableContext.tableName)} WHERE ${sqlPath} IS NOT NULL${where} GROUP BY ${sqlPath} ORDER BY ${this.escapeIdentifier('count')} DESC;`;
  }
}
