import type { ModelType } from '@travetto/model';
import { ModelQueryUtil, type SortClause, type WhereClause } from '@travetto/model-query';
import { type Class, castTo, JSONUtil, RuntimeError } from '@travetto/runtime';
import { DataUtil, type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { SQLDialect } from './dialect.ts';

interface QueryClause {
  sql?: string;
  parameters?: Record<string, unknown>;
}

type IdentPath = string;

export interface TableContext<T extends ModelType> {
  cls: Class<T>;
  tableName: string;
  simpleFields: Map<string, SchemaFieldConfig>;
  complexFields: Map<string, SchemaFieldConfig>;
  allFields: SchemaFieldConfig[];
}

/**
 * Result of query compilation
 */
export interface CompilationResult {
  whereSQL?: string;
  parameters?: unknown[];
}

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
 * AST Query Compiler for SQL/JSON Model services
 */
export class SQLQueryCompiler {
  /**
   * Compiles a WhereClause into a parameterized SQL WHERE clause.
   */
  static compileWhere<T extends ModelType>(
    dialect: SQLDialect,
    context: TableContext<T>,
    where?: WhereClause<T>,
    checkExpiry = true
  ): CompilationResult {
    const resolvedWhere = ModelQueryUtil.getWhereClause(context.cls, where, checkExpiry);
    const compiled = this.#compileClause(dialect, context, resolvedWhere);
    if (Object.entries(compiled.parameters ?? {}).length) {
      const parameters: unknown[] = [];
      const seen = new Map<string, string>();
      const sql = compiled
        .sql!.replace(/%%([^%]{0,200})%%/g, key => {
          if (!seen.has(key)) {
            parameters.push(compiled.parameters![key]);
            seen.set(key, dialect.getPlaceholder(parameters.length));
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
  static compileSort<T extends ModelType>(dialect: SQLDialect, context: TableContext<T>, sort?: SortClause<T>[]): string {
    if (!sort || sort.length === 0) {
      return '';
    }
    const sortClauses = sort.map(sortClause => {
      const key = Object.keys(sortClause)[0];
      const direction = castTo<Record<string, 1 | -1>>(sortClause)[key];
      const path = key.split('.');
      const { sqlPath } = this.resolvePath(dialect, context, path);
      return `${sqlPath} ${direction === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }

  /**
   * Resolves a field path to a database SQL expression and retrieves its schema config.
   */
  static resolvePath<T extends ModelType>(
    dialect: SQLDialect,
    context: TableContext<T>,
    path: string[]
  ): { sqlPath: string; leafField?: SchemaFieldConfig } {
    const firstSegment = path[0];

    if (context.simpleFields.has(firstSegment)) {
      if (path.length > 1) {
        throw new RuntimeError(`Cannot traverse nested properties under simple column "${firstSegment}" in table "${context.tableName}"`, {
          category: 'data'
        });
      }
      const leafField = context.simpleFields.get(firstSegment);
      return { sqlPath: dialect.escapeIdentifier(firstSegment), leafField };
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

    let compiledPath = dialect.compileIndexPath(context.tableName, context.simpleFields, path);

    // Apply type casting for JSON extract values
    if (currentField && !currentField.array) {
      compiledPath = dialect.castColumn(compiledPath, currentField.type);
    }

    return { sqlPath: compiledPath, leafField: currentField };
  }

  /**
   * Recursively compiles logical AND/OR/NOT clauses and simple field mappings
   */
  static #compileClause<T extends ModelType>(
    dialect: SQLDialect,
    context: TableContext<T>,
    clause: WhereClause<T>,
    identPath: IdentPath = ''
  ): QueryClause {
    if (!clause) {
      return {};
    }
    if (ModelQueryUtil.has$And(clause)) {
      const compiled = clause.$and.map((item, i) => this.#compileClause(dialect, context, item, `${identPath}_${i}`)).filter(Boolean);
      return combineResults(compiled, 'AND');
    } else if (ModelQueryUtil.has$Or(clause)) {
      const compiled = clause.$or.map((item, i) => this.#compileClause(dialect, context, item, `${identPath}_${i}`)).filter(Boolean);
      return combineResults(compiled, 'OR');
    } else if (ModelQueryUtil.has$Not(clause)) {
      const compiled = this.#compileClause(dialect, context, clause.$not, identPath);
      return compiled
        ? {
            sql: `NOT (${compiled.sql})`,
            parameters: compiled.parameters
          }
        : {};
    } else {
      return this.#compileSimple(dialect, context, clause, [], identPath);
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
    dialect: SQLDialect,
    context: TableContext<T>,
    item: Record<string, unknown>,
    parentPath: string[] = [],
    identPath: IdentPath = ''
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

      const { sqlPath, leafField } = this.resolvePath(dialect, context, currentPath);
      const nextIdentPath = `${identPath}__${idx}`;

      if (leafField?.array && SchemaRegistryIndex.has(leafField.type) && isPlainObject && !firstKey.startsWith('$')) {
        const template = this.#buildJsonTemplate(value as Record<string, unknown>);
        const ident = `%%${nextIdentPath}%%`;
        clauses.push({
          sql: dialect.compileArrayContains(sqlPath, ident, true, leafField?.type),
          parameters: {
            [ident]: JSONUtil.toUTF8([template])
          }
        });
      } else if (isPlainObject && firstKey.startsWith('$')) {
        clauses.push(this.#compileOperator(dialect, context, currentPath, value as Record<string, unknown>, nextIdentPath));
      } else if (isPlainObject) {
        clauses.push(this.#compileSimple(dialect, context, value as Record<string, unknown>, currentPath, nextIdentPath));
      } else {
        clauses.push(this.#compileOperator(dialect, context, currentPath, { $eq: value }, nextIdentPath));
      }
    }

    return combineResults(clauses, 'AND');
  }

  /**
   * Compiles individual operators like $eq, $gt, $in, $regex etc.
   */
  static #compileOperator<T extends ModelType>(
    dialect: SQLDialect,
    context: TableContext<T>,
    path: string[],
    operation: Record<string, unknown>,
    identPath: IdentPath = ''
  ): QueryClause {
    const { sqlPath, leafField } = this.resolvePath(dialect, context, path);
    const clauses: QueryClause[] = [];

    let idx = 0;
    for (let [operator, value] of Object.entries(operation)) {
      idx += 1;

      if (Array.isArray(value)) {
        value = value.map(val => ModelQueryUtil.resolveComparator(val));
      } else {
        value = ModelQueryUtil.resolveComparator(value);
      }

      const nestedIdentPath = `${identPath}_${idx}`;
      const ident = `%%${nestedIdentPath}%%`;

      let clause: QueryClause;

      // Handle JSON array queries
      if (leafField?.array) {
        const isObject = typeof value === 'object' && value !== null;
        if (operator === '$eq') {
          const formatted = isObject ? JSONUtil.toUTF8(value) : value;
          clause = {
            parameters: { [ident]: formatted },
            sql: dialect.compileArrayContains(sqlPath, ident, isObject, leafField?.type)
          };
        } else if (operator === '$ne') {
          const formatted = isObject ? JSONUtil.toUTF8(value) : value;
          clause = {
            parameters: { [ident]: formatted },
            sql: `NOT (${dialect.compileArrayContains(sqlPath, ident, isObject, leafField?.type)})`
          };
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            const choices = value.map((val, i) => {
              const innerIdent = `%%${nestedIdentPath}_${i}%%`;
              const innerIsObject = typeof val === 'object' && val !== null;
              const formattedVal = innerIsObject ? JSONUtil.toUTF8(val) : val;
              return {
                sql: dialect.compileArrayContains(sqlPath, innerIdent, innerIsObject, leafField?.type),
                parameters: { [innerIdent]: formattedVal }
              };
            });
            clause = combineResults(choices, 'OR');
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = {};
          } else {
            const choices = value.map((val, i) => {
              const innerIdent = `%%${nestedIdentPath}_${i}%%`;
              const innerIsObject = typeof val === 'object' && val !== null;
              const formattedVal = innerIsObject ? JSONUtil.toUTF8(val) : val;
              return {
                sql: `NOT (${dialect.compileArrayContains(sqlPath, innerIdent, innerIsObject, leafField?.type)})`,
                parameters: { [innerIdent]: formattedVal }
              };
            });
            clause = combineResults(choices, 'AND');
          }
        } else if (operator === '$all') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = { sql: '1=0' };
          } else {
            // For $all, checking that array contains all elements.
            // Postgres and MySQL can use containment directly if we serialize the array,
            // but SQLite requires separate EXISTS check for each item.
            // To be completely general and support all DBs robustly:
            // We compile it as separate choices joined by AND!
            const choices = value.map((val, i) => {
              const innerIdent = `%%${nestedIdentPath}_${i}%%`;
              const innerIsObject = typeof val === 'object' && val !== null;
              const formattedVal = innerIsObject ? JSONUtil.toUTF8(val) : val;
              return {
                sql: dialect.compileArrayContains(sqlPath, innerIdent, innerIsObject, leafField?.type),
                parameters: { [innerIdent]: formattedVal }
              };
            });
            clause = combineResults(choices, 'AND');
          }
        } else if (operator === '$exists') {
          const emptyArrayStr = JSONUtil.toUTF8([]);
          const isNull = `${sqlPath} IS NULL`;
          const isEmpty = dialect.compileJsonEquality ? dialect.compileJsonEquality(sqlPath, ident) : `${sqlPath} = ${ident}`;
          if (value) {
            // Check that it's not null and not empty array
            clause = {
              parameters: { [ident]: emptyArrayStr },
              sql: `NOT (${isNull} OR ${isEmpty})`
            };
          } else {
            clause = {
              parameters: { [ident]: emptyArrayStr },
              sql: `(${isNull} OR ${isEmpty})`
            };
          }
        } else {
          throw new RuntimeError(`Operator "${operator}" is not supported for arrays`, { category: 'data' });
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
              parameters: { [ident]: value }
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
            const choices = value.map((val, i) => {
              const innerIdent = `%%${nestedIdentPath}_${i}%%`;
              return [innerIdent, val];
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
              const innerIdent = `%%${nestedIdentPath}_${i}%%`;
              return [innerIdent, val];
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
          const caseInsensitive = regex.flags.includes('i');
          const regexOp = dialect.getRegexOperator(caseInsensitive);
          const regexSource = dialect.formatRegex(regex.source, caseInsensitive);
          clause = {
            parameters: { [ident]: regexSource },
            sql: `${sqlPath} ${regexOp} ${ident}`
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
