import type { ModelType } from '@travetto/model';
import { ModelQueryUtil, type SortClause, type WhereClause } from '@travetto/model-query';
import { castTo, JSONUtil, RuntimeError } from '@travetto/runtime';
import { DataUtil, type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import { PostgresJsonUtil, type TableContext } from './util.ts';

/**
 * Result of query compilation
 */
export interface QueryClause {
  sql?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Result of query compilation
 */
export interface CompilationResult {
  whereSQL?: string;
  parameters?: unknown[];
}

type IdentPath = (string | number)[];

const combineResults = (results: QueryClause[], op: string): QueryClause => {
  const filtered = results.filter(x => !!x.sql);

  if (filtered.length === 0) {
    return {};
  } else if (filtered.length === 1) {
    return filtered[0];
  } else {
    const fullOp = ` ${op} `;
    return {
      sql: `(${filtered.map(x => x.sql).join(fullOp)})`,
      parameters: Object.assign({}, ...results.map(x => x.parameters))
    };
  }
};

/**
 * AST Query Compiler for Postgres JSON Model service
 */
export class PostgresJsonQueryCompiler {
  /**
   * Compiles a WhereClause into a parameterized PostgreSQL WHERE clause.
   */
  static compileWhere<T extends ModelType>(context: TableContext<T>, where?: WhereClause<T>, checkExpiry = true): CompilationResult {
    const resolvedWhere = ModelQueryUtil.getWhereClause(context.cls, where, checkExpiry);
    const compiled = this.#compileClause(context, resolvedWhere);
    if (Object.entries(compiled.parameters ?? {}).length) {
      const parameters: unknown[] = [];
      const seen = new Map<string, string>();
      const sql = compiled
        .sql!.replace(/%%([^%]{0,200})%%/g, key => {
          if (!seen.has(key)) {
            parameters.push(compiled.parameters![key]);
            seen.set(key, `$${parameters.length}`);
          }
          return seen.get(key)!;
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

    if (context.simpleFieldNameSet.has(firstSegment)) {
      if (path.length > 1) {
        throw new RuntimeError(`Cannot traverse nested properties under simple column "${firstSegment}" in table "${context.tableName}"`, {
          category: 'data'
        });
      }
      const leafField = context.simpleFields.find(field => field.name === firstSegment);
      return { sqlPath: PostgresJsonUtil.escapeIdentifier(firstSegment), leafField };
    }

    // Traverse schema starting at root model
    let currentField: SchemaFieldConfig | undefined;
    currentField = context.complexFields.find(field => field.name === firstSegment);

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

    const accessorSql = (columnName: string, pathSegments: string[], isJsonb: boolean): string => {
      const escapedColumn = PostgresJsonUtil.escapeIdentifier(columnName);

      if (pathSegments.length === 0) {
        return escapedColumn;
      }
      if (isJsonb) {
        const parts = pathSegments.map(segment => `->'${PostgresJsonUtil.escapeLiteral(segment)}'`).join('');
        return `(${escapedColumn}${parts})`;
      } else {
        const body = pathSegments
          .slice(0, -1)
          .map(segment => `->'${PostgresJsonUtil.escapeLiteral(segment)}'`)
          .join('');
        const leaf = pathSegments[pathSegments.length - 1];
        return `(${escapedColumn}${body}->>'${PostgresJsonUtil.escapeLiteral(leaf)}')`;
      }
    };

    if (currentField?.array) {
      const sqlPath = accessorSql(firstSegment, jsonPath, true);
      return { sqlPath, leafField: currentField };
    }

    let compiledPath = accessorSql(firstSegment, jsonPath, false);

    // Apply type casting for JSONB extract text values
    if (currentField) {
      if (currentField.type === Number) {
        compiledPath = `(${compiledPath})::NUMERIC`;
      } else if (currentField.type === Boolean) {
        compiledPath = `(${compiledPath})::BOOLEAN`;
      } else if (currentField.type === Date) {
        compiledPath = `(${compiledPath})::TIMESTAMP WITH TIME ZONE`;
      }
    }

    return { sqlPath: compiledPath, leafField: currentField };
  }

  /**
   * Recursively compiles logical AND/OR/NOT clauses and simple field mappings
   */
  static #compileClause<T extends ModelType>(context: TableContext<T>, clause: WhereClause<T>, identPath: IdentPath = []): QueryClause {
    if (!clause) {
      return {};
    }
    if (ModelQueryUtil.has$And(clause)) {
      const compiled = clause.$and.map((item, i) => this.#compileClause(context, item, [...identPath, i])).filter(Boolean);
      return combineResults(compiled, 'AND');
    } else if (ModelQueryUtil.has$Or(clause)) {
      const compiled = clause.$or.map((item, i) => this.#compileClause(context, item, [...identPath, i])).filter(Boolean);
      return combineResults(compiled, 'OR');
    } else if (ModelQueryUtil.has$Not(clause)) {
      const compiled = this.#compileClause(context, clause.$not, identPath);
      return compiled
        ? {
            sql: `NOT (${compiled.sql})`,
            parameters: compiled.parameters
          }
        : {};
    } else {
      return this.#compileSimple(context, clause, [], identPath);
    }
  }

  /**
   * Helper to build JSON template for array of object queries
   */
  static #buildJsonTemplate(queryObj: Record<string, unknown>): Record<string, unknown> {
    const template: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(queryObj)) {
      if (DataUtil.isPlainObject(v)) {
        const firstKey = Object.keys(v)[0];
        const valObj = castTo<Record<string, unknown>>(v);
        if (firstKey === '$eq') {
          template[k] = valObj.$eq;
        } else if (valObj.$eq !== undefined) {
          template[k] = valObj.$eq;
        } else if (!firstKey.startsWith('$')) {
          template[k] = this.#buildJsonTemplate(valObj);
        } else {
          throw new RuntimeError(`Unsupported operator ${firstKey} in nested array query`, { category: 'data' });
        }
      } else {
        template[k] = v;
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
    identPath: IdentPath = []
  ): QueryClause {
    if (!item) {
      return {};
    }
    const clauses: QueryClause[] = [];

    let idx = 0;
    for (const [key, value] of Object.entries(item)) {
      idx += 1;
      const currentPath = [...parentPath, key];
      const isPlainObject = DataUtil.isPlainObject(value);
      const firstKey = isPlainObject ? Object.keys(value)[0] : '';

      const { sqlPath, leafField } = this.resolvePath(context, currentPath);
      const nextIdentPath = [...identPath, idx];

      if (leafField?.array && SchemaRegistryIndex.has(leafField.type) && isPlainObject && !firstKey.startsWith('$')) {
        const template = this.#buildJsonTemplate(value as Record<string, unknown>);
        const ident = `%%${nextIdentPath.join('_')}%%`;
        clauses.push({
          sql: `${sqlPath} @> ${ident}::jsonb`,
          parameters: {
            [ident]: JSONUtil.toUTF8([template])
          }
        });
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
   * Compiles individual operators like $eq, $gt, $in, $regex etc.
   */
  static #compileOperator<T extends ModelType>(
    context: TableContext<T>,
    path: string[],
    operation: Record<string, unknown>,
    identPath: IdentPath = []
  ): QueryClause {
    const { sqlPath, leafField } = this.resolvePath(context, path);
    const clauses: QueryClause[] = [];

    let idx = 0;
    for (let [operator, value] of Object.entries(operation)) {
      idx += 1;

      if (Array.isArray(value)) {
        value = value.map(val => ModelQueryUtil.resolveComparator(val));
      } else {
        value = ModelQueryUtil.resolveComparator(value);
      }

      const nestedIdentPath = [...identPath, idx];
      const ident = `%%${nestedIdentPath.join('_')}%%`;

      let clause: QueryClause;

      // Handle JSONB array queries
      if (leafField?.array) {
        if (operator === '$eq') {
          clause = { parameters: { [ident]: JSONUtil.toUTF8([value]) }, sql: `${sqlPath} @> ${ident}::jsonb` };
        } else if (operator === '$ne') {
          clause = { parameters: { [ident]: JSONUtil.toUTF8([value]) }, sql: `NOT (${sqlPath} @> ${ident}::jsonb)` };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const innerClauses = value.map((val, i) => {
              const innerIdent = `%%${[...nestedIdentPath, i].join('_')}%%`;
              return {
                sql: `${sqlPath} @> ${innerIdent}::jsonb`,
                parameters: { [innerIdent]: JSONUtil.toUTF8([val]) }
              };
            });
            clause = combineResults(innerClauses, 'OR');
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const innerClauses = value.map((val, i) => {
              const innerIdent = `%%${[...nestedIdentPath, i].join('_')}%%`;
              return {
                sql: `NOT (${sqlPath} @> ${innerIdent}::jsonb)`,
                parameters: { [innerIdent]: JSONUtil.toUTF8([val]) }
              };
            });
            clause = combineResults(innerClauses, 'AND');
          }
        } else if (operator === '$all') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            clause = {
              sql: `${sqlPath} @> ${ident}::jsonb`,
              parameters: { [ident]: JSONUtil.toUTF8(value) }
            };
          }
        } else if (operator === '$exists') {
          if (value) {
            clause = { sql: `${sqlPath} IS NOT NULL AND ${sqlPath} <> '[]'::jsonb` };
          } else {
            clause = { sql: `(${sqlPath} IS NULL OR ${sqlPath} = '[]'::jsonb)` };
          }
        } else {
          throw new RuntimeError(`Operator "${operator}" is not supported for JSONB arrays`, { category: 'data' });
        }
      } else {
        // Standard scalar queries
        if (operator === '$eq') {
          if (value === null || value === undefined) {
            clause = { sql: `${sqlPath} IS NULL` };
          } else {
            clause = {
              sql: `${sqlPath} = ${ident}`,
              parameters: { [ident]: value }
            };
          }
        } else if (operator === '$ne') {
          if (value === null || value === undefined) {
            clause = { sql: `${sqlPath} IS NOT NULL` };
          } else {
            clause = {
              sql: `${sqlPath} <> ${ident}`,
              parameters: {
                [ident]: value
              }
            };
          }
        } else if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
          const sqlOperator = operator === '$gt' ? '>' : operator === '$gte' ? '>=' : operator === '$lt' ? '<' : '<=';
          clause = {
            sql: `${sqlPath} ${sqlOperator} ${ident}`,
            parameters: { [ident]: value }
          };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const innerIdents = value.map((val, i) => {
              const innerIdent = `%%${[...nestedIdentPath, i].join('_')}%%`;
              return [innerIdent, val];
            });
            clause = {
              sql: `${sqlPath} IN (${innerIdents.map(x => x[0]).join(', ')})`,
              parameters: Object.fromEntries(innerIdents)
            };
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const innerIdents = value.map((val, i) => {
              const innerIdent = `%%${[...nestedIdentPath, i].join('_')}%%`;
              return [innerIdent, val];
            });
            clause = {
              sql: `${sqlPath} NOT IN (${innerIdents.map(x => x[0]).join(', ')})`,
              parameters: Object.fromEntries(innerIdents)
            };
          }
        } else if (operator === '$exists') {
          clause = { sql: value ? `${sqlPath} IS NOT NULL` : `${sqlPath} IS NULL` };
        } else if (operator === '$regex') {
          const regex = value instanceof RegExp ? value : new RegExp(String(value));
          const caseInsensitive = regex.flags.includes('i');
          clause = {
            parameters: { [ident]: regex.source.replaceAll('\\b', '\\y') },
            sql: `${sqlPath} ${caseInsensitive ? '~*' : '~'} ${ident}`
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
