import type { ModelType } from '@travetto/model';
import { ModelQueryUtil, type SortClause, type WhereClause } from '@travetto/model-query';
import { castTo, JSONUtil, RuntimeError } from '@travetto/runtime';
import { DataUtil, type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import { SqliteJsonUtil, type TableContext } from './util.ts';

interface QueryClause {
  sql?: string;
  parameters?: Record<string, unknown>;
}

type IdentifierPath = string;

/**
 * Result of query compilation
 */
export interface CompilationResult {
  whereSQL?: string;
  parameters?: unknown[];
}

const combineResults = (results: QueryClause[], operator: string): QueryClause => {
  const filtered = results.filter(item => !!item.sql);

  if (filtered.length === 0) {
    return {};
  } else if (filtered.length === 1) {
    return filtered[0];
  } else {
    const fullOperator = ` ${operator} `;
    return {
      sql: `(${filtered.map(item => item.sql).join(fullOperator)})`,
      parameters: Object.assign({}, ...results.map(item => item.parameters))
    };
  }
};

/**
 * AST Query Compiler for SQLite JSON Model service
 */
export class SqliteJsonQueryCompiler {
  /**
   * Compiles a WhereClause into a parameterized SQLite WHERE clause.
   */
  static compileWhere<T extends ModelType>(context: TableContext<T>, where?: WhereClause<T>, checkExpiry = true): CompilationResult {
    const resolvedWhere = ModelQueryUtil.getWhereClause(context.modelClass, where, checkExpiry);
    const compiled = this.#compileClause(context, resolvedWhere);
    if (Object.entries(compiled.parameters ?? {}).length) {
      const parameters: unknown[] = [];
      const sql = compiled
        .sql!.replace(/%%([^%]{0,200})%%/g, key => {
          parameters.push(compiled.parameters![key]);
          return '?';
        })
        .trim();
      return { whereSQL: sql, parameters };
    } else {
      return { whereSQL: compiled.sql?.trim() };
    }
  }

  /**
   * Compiles sorting clauses into SQL ORDER BY string.
   */
  static compileSort<T extends ModelType>(context: TableContext<T>, sort?: SortClause<T>[]): string {
    if (!sort || sort.length === 0) {
      return '';
    }
    const sortClauses = sort.map(sortClause => {
      const key = Object.keys(sortClause)[0];
      const direction = castTo<Record<string, 1 | -1>>(sortClause)[key];
      const path = key.split('.');
      const { sqlPath } = this.resolvePath(context, path);
      return `${sqlPath} ${direction === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }

  /**
   * Resolves a field path to a database SQL expression and retrieves its schema config.
   */
  static resolvePath<T extends ModelType>(context: TableContext<T>, path: string[]): { sqlPath: string; leafField?: SchemaFieldConfig } {
    const firstSegment = path[0];

    if (context.simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new RuntimeError(`Cannot traverse nested properties under simple column "${firstSegment}" in table "${context.tableName}"`, {
          category: 'data'
        });
      }
      const leafField = context.simpleFields.get(firstSegment);
      return { sqlPath: `"${firstSegment}"`, leafField };
    }

    // Traverse schema starting at root model
    let currentField: SchemaFieldConfig | undefined;
    currentField = context.complexFields.get(firstSegment);

    let currentClass = currentField?.type;
    const jsonPath = path.slice(1);

    for (let index = 0; index < jsonPath.length - 1; index++) {
      const segment = jsonPath[index];
      const subConfig = SchemaRegistryIndex.getOptional(currentClass!)?.get();
      currentField = subConfig?.fields[segment];
      currentClass = currentField?.type;
    }

    if (jsonPath.length > 0) {
      const leafSegment = jsonPath[jsonPath.length - 1];
      const subConfig = SchemaRegistryIndex.getOptional(currentClass!)?.get();
      currentField = subConfig?.fields[leafSegment];
    }

    const accessorSql = (columnName: string, pathSegments: string[], isJson: boolean): string => {
      const escapedColumn = SqliteJsonUtil.escapeIdentifier(columnName);

      if (pathSegments.length === 0) {
        return escapedColumn;
      }
      const pathString = `$.${pathSegments.map(segment => SqliteJsonUtil.escapeLiteral(segment)).join('.')}`;
      return `(${escapedColumn} ${isJson ? '->' : '->>'} '${pathString}')`;
    };

    if (currentField?.array) {
      const sqlPath = accessorSql(firstSegment, jsonPath, true);
      return { sqlPath, leafField: currentField };
    }

    let compiledPath = accessorSql(firstSegment, jsonPath, false);

    // Apply type casting for SQLite extract text values
    if (currentField) {
      if (currentField.type === Number) {
        compiledPath = `CAST(${compiledPath} AS NUMERIC)`;
      } else if (currentField.type === Boolean) {
        compiledPath = `CAST(${compiledPath} AS INTEGER)`;
      } else if (currentField.type === Date) {
        compiledPath = `CAST(${compiledPath} AS INTEGER)`;
      }
    }

    return { sqlPath: compiledPath, leafField: currentField };
  }

  /**
   * Recursively compiles logical AND/OR/NOT clauses and simple field mappings
   */
  static #compileClause<T extends ModelType>(
    context: TableContext<T>,
    clause: WhereClause<T>,
    identifierPath: IdentifierPath = ''
  ): QueryClause {
    if (!clause) {
      return {};
    }
    if (ModelQueryUtil.has$And(clause)) {
      const compiled = clause.$and.map((item, index) => this.#compileClause(context, item, `${identifierPath}_${index}`)).filter(Boolean);
      return combineResults(compiled, 'AND');
    } else if (ModelQueryUtil.has$Or(clause)) {
      const compiled = clause.$or.map((item, index) => this.#compileClause(context, item, `${identifierPath}_${index}`)).filter(Boolean);
      return combineResults(compiled, 'OR');
    } else if (ModelQueryUtil.has$Not(clause)) {
      const compiled = this.#compileClause(context, clause.$not, identifierPath);
      return compiled
        ? {
            sql: `NOT (${compiled.sql})`,
            parameters: compiled.parameters
          }
        : {};
    } else {
      return this.#compileSimple(context, clause, [], identifierPath);
    }
  }

  /**
   * Helper to build JSON template for array of object queries
   */
  static #buildJsonTemplate(queryObj: Record<string, unknown>): Record<string, unknown> {
    const template: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(queryObj)) {
      if (DataUtil.isPlainObject(value)) {
        const firstKey = Object.keys(value)[0];
        const valObj = castTo<Record<string, unknown>>(value);
        if (firstKey === '$eq') {
          template[key] = valObj.$eq;
        } else if (valObj.$eq !== undefined) {
          template[key] = valObj.$eq;
        } else if (!firstKey.startsWith('$')) {
          template[key] = this.#buildJsonTemplate(valObj);
        } else {
          throw new RuntimeError(`Unsupported operator ${firstKey} in nested array query`, { category: 'data' });
        }
      } else {
        template[key] = value;
      }
    }
    return template;
  }

  /**
   * Compiles simple query object schemas recursively
   */
  static #compileSimple<T extends ModelType>(
    context: TableContext<T>,
    item: Record<string, unknown>,
    parentPath: string[] = [],
    identifierPath: IdentifierPath = ''
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

      const { sqlPath, leafField } = this.resolvePath(context, currentPath);
      const nextIdentPath = `${identifierPath}__${index}`;

      if (leafField?.array && SchemaRegistryIndex.has(leafField.type) && isPlainObject && !firstKey.startsWith('$')) {
        const subClause = this.#compileSubQuery(sqlPath, value as Record<string, unknown>, nextIdentPath);
        if (subClause.sql) {
          clauses.push(subClause);
        }
      } else if (isPlainObject && firstKey.startsWith('$')) {
        clauses.push(this.#compileOperator(context, currentPath, value as Record<string, unknown>, nextIdentPath));
      } else if (isPlainObject) {
        clauses.push(this.#compileSimple(context, value as Record<string, unknown>, currentPath, nextIdentPath));
      } else {
        clauses.push(this.#compileOperator(context, currentPath, { $eq: value }, nextIdentPath));
      }
    }

    return combineResults(clauses, 'AND');
  }

  /**
   * Compiles nested object queries within array elements using SQLite's json_each table-valued function.
   */
  static #compileSubQuery(sqlPath: string, queryObj: Record<string, unknown>, identifierPath: string): QueryClause {
    const clauses: string[] = [];
    const parameters: Record<string, unknown> = {};

    const traverse = (obj: Record<string, unknown>, pathSegments: string[], stepIndex: number) => {
      let index = 0;
      for (const [key, value] of Object.entries(obj)) {
        index += 1;
        const currentPath = [...pathSegments, key];
        const nextIdentPath = `${identifierPath}_sub_${stepIndex}_${index}`;
        const placeholder = `%%${nextIdentPath}%%`;

        if (DataUtil.isPlainObject(value)) {
          const keys = Object.keys(value);
          const firstKey = keys[0];
          if (firstKey.startsWith('$')) {
            for (const [operator, operatorValue] of Object.entries(value)) {
              const operatorPlaceholder = `%%${nextIdentPath}_${operator.slice(1)}%%`;
              const pathStr = currentPath.join('.');
              const expr = `(json_each.value ->> '$.${pathStr}')`;

              if (operator === '$eq') {
                if (operatorValue === null || operatorValue === undefined) {
                  clauses.push(`${expr} IS NULL`);
                } else {
                  clauses.push(`${expr} = ${operatorPlaceholder}`);
                  parameters[operatorPlaceholder] = operatorValue;
                }
              } else if (operator === '$ne') {
                if (operatorValue === null || operatorValue === undefined) {
                  clauses.push(`${expr} IS NOT NULL`);
                } else {
                  clauses.push(`${expr} <> ${operatorPlaceholder}`);
                  parameters[operatorPlaceholder] = operatorValue;
                }
              } else if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
                const sqlOperator = operator === '$gt' ? '>' : operator === '$gte' ? '>=' : operator === '$lt' ? '<' : '<=';
                clauses.push(`${expr} ${sqlOperator} ${operatorPlaceholder}`);
                parameters[operatorPlaceholder] = operatorValue;
              } else if (operator === '$in') {
                if (Array.isArray(operatorValue) && operatorValue.length > 0) {
                  const inPlaceholders = operatorValue.map((val, i) => {
                    const innerPlaceholder = `%%${nextIdentPath}_in_${i}%%`;
                    parameters[innerPlaceholder] = val;
                    return innerPlaceholder;
                  });
                  clauses.push(`${expr} IN (${inPlaceholders.join(', ')})`);
                } else {
                  clauses.push('1=0');
                }
              } else if (operator === '$nin') {
                if (Array.isArray(operatorValue) && operatorValue.length > 0) {
                  const ninPlaceholders = operatorValue.map((val, i) => {
                    const innerPlaceholder = `%%${nextIdentPath}_nin_${i}%%`;
                    parameters[innerPlaceholder] = val;
                    return innerPlaceholder;
                  });
                  clauses.push(`${expr} NOT IN (${ninPlaceholders.join(', ')})`);
                }
              } else if (operator === '$exists') {
                clauses.push(operatorValue ? `${expr} IS NOT NULL` : `${expr} IS NULL`);
              } else if (operator === '$regex') {
                clauses.push(`${expr} REGEXP ${operatorPlaceholder}`);
                parameters[operatorPlaceholder] = operatorValue instanceof RegExp ? operatorValue.source : String(operatorValue);
              }
            }
          } else {
            traverse(value, currentPath, stepIndex + 1);
          }
        } else {
          const pathStr = currentPath.join('.');
          const expr = `(json_each.value ->> '$.${pathStr}')`;
          if (value === null || value === undefined) {
            clauses.push(`${expr} IS NULL`);
          } else {
            clauses.push(`${expr} = ${placeholder}`);
            parameters[placeholder] = value;
          }
        }
      }
    };

    traverse(queryObj, [], 0);

    if (clauses.length === 0) {
      return {};
    }

    return {
      sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE ${clauses.join(' AND ')})`,
      parameters
    };
  }

  /**
   * Compiles individual operators like $eq, $gt, $in, $regex etc.
   */
  static #compileOperator<T extends ModelType>(
    context: TableContext<T>,
    path: string[],
    operation: Record<string, unknown>,
    identifierPath: IdentifierPath = ''
  ): QueryClause {
    const { sqlPath, leafField } = this.resolvePath(context, path);
    const clauses: QueryClause[] = [];

    let index = 0;
    for (let [operator, value] of Object.entries(operation)) {
      index += 1;

      if (Array.isArray(value)) {
        value = value.map(val => ModelQueryUtil.resolveComparator(val));
      } else {
        value = ModelQueryUtil.resolveComparator(value);
      }

      const nestedIdentPath = `${identifierPath}_${index}`;
      const placeholder = `%%${nestedIdentPath}%%`;

      let clause: QueryClause;

      // Handle SQLite JSON array queries using json_each
      if (leafField?.array) {
        if (operator === '$eq') {
          const isObject = typeof value === 'object' && value !== null;
          clause = {
            parameters: { [placeholder]: isObject ? JSONUtil.toUTF8(value) : value },
            sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${placeholder})` : placeholder})`
          };
        } else if (operator === '$ne') {
          const isObject = typeof value === 'object' && value !== null;
          clause = {
            parameters: { [placeholder]: isObject ? JSONUtil.toUTF8(value) : value },
            sql: `NOT EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${placeholder})` : placeholder})`
          };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((val, i) => {
              const innerPlaceholder = `%%${nestedIdentPath}_${i}%%`;
              const isObject = typeof val === 'object' && val !== null;
              return {
                sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${innerPlaceholder})` : innerPlaceholder})`,
                parameters: { [innerPlaceholder]: isObject ? JSONUtil.toUTF8(val) : val }
              };
            });
            clause = combineResults(choices, 'OR');
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const choices = value.map((val, i) => {
              const innerPlaceholder = `%%${nestedIdentPath}_${i}%%`;
              const isObject = typeof val === 'object' && val !== null;
              return {
                sql: `NOT EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${innerPlaceholder})` : innerPlaceholder})`,
                parameters: { [innerPlaceholder]: isObject ? JSONUtil.toUTF8(val) : val }
              };
            });
            clause = combineResults(choices, 'AND');
          }
        } else if (operator === '$all') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((val, i) => {
              const innerPlaceholder = `%%${nestedIdentPath}_${i}%%`;
              const isObject = typeof val === 'object' && val !== null;
              return {
                sql: `EXISTS (SELECT 1 FROM json_each(${sqlPath}) WHERE json_each.value = ${isObject ? `json(${innerPlaceholder})` : innerPlaceholder})`,
                parameters: { [innerPlaceholder]: isObject ? JSONUtil.toUTF8(val) : val }
              };
            });
            clause = combineResults(choices, 'AND');
          }
        } else if (operator === '$exists') {
          if (value) {
            clause = { sql: `${sqlPath} IS NOT NULL AND ${sqlPath} <> '[]' AND ${sqlPath} <> ''` };
          } else {
            clause = { sql: `(${sqlPath} IS NULL OR ${sqlPath} = '[]' OR ${sqlPath} = '')` };
          }
        } else {
          throw new RuntimeError(`Operator "${operator}" is not supported for SQLite arrays`, { category: 'data' });
        }
      } else {
        // Standard scalar queries
        if (operator === '$eq') {
          if (value === null || value === undefined) {
            clause = { sql: `${sqlPath} IS NULL` };
          } else {
            clause = {
              sql: `${sqlPath} = ${placeholder}`,
              parameters: { [placeholder]: value }
            };
          }
        } else if (operator === '$ne') {
          if (value === null || value === undefined) {
            clause = { sql: `${sqlPath} IS NOT NULL` };
          } else {
            clause = {
              sql: `${sqlPath} <> ${placeholder}`,
              parameters: {
                [placeholder]: value
              }
            };
          }
        } else if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
          const sqlOperator = operator === '$gt' ? '>' : operator === '$gte' ? '>=' : operator === '$lt' ? '<' : '<=';
          clause = {
            sql: `${sqlPath} ${sqlOperator} ${placeholder}`,
            parameters: { [placeholder]: value }
          };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((val, i) => {
              const innerPlaceholder = `%%${nestedIdentPath}_${i}%%`;
              return [innerPlaceholder, val];
            });
            clause = {
              sql: `${sqlPath} IN (${choices.map(x => x[0]).join(', ')})`,
              parameters: Object.fromEntries(choices)
            };
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const choices = value.map((val, i) => {
              const innerPlaceholder = `%%${nestedIdentPath}_${i}%%`;
              return [innerPlaceholder, val];
            });
            clause = {
              sql: `${sqlPath} NOT IN (${choices.map(x => x[0]).join(', ')})`,
              parameters: Object.fromEntries(choices)
            };
          }
        } else if (operator === '$exists') {
          clause = { sql: value ? `${sqlPath} IS NOT NULL` : `${sqlPath} IS NULL` };
        } else if (operator === '$regex') {
          const regex = value instanceof RegExp ? value : new RegExp(String(value));
          const serializedPattern = regex.flags ? `/${regex.source}/${regex.flags}` : regex.source;
          clause = {
            parameters: { [placeholder]: serializedPattern },
            sql: `${sqlPath} REGEXP ${placeholder}`
          };
        } else {
          throw new RuntimeError(`Operator "${operator}" is not supported for scalar columns`, { category: 'data' });
        }
      }

      if (clause) {
        clauses.push(clause);
      }
    }
    return combineResults(clauses, 'AND');
  }
}
