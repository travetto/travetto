import type { ModelType } from '@travetto/model';
import { ModelQueryUtil, type SortClause, type WhereClause } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import { PostgresJsonTableManager } from './table-manager.ts';
import { PostgresJsonUtil } from './util.ts';

/**
 * Result of query compilation
 */
export interface CompilationResult {
  whereSQL: string;
  parameters: unknown[];
}

/**
 * Compilation context containing metadata and parameters
 */
export interface CompilerContext {
  modelClass: Class;
  tableName: string;
  simpleFieldsSet: Set<string>;
  parameters: unknown[];
}

/**
 * AST Query Compiler for Postgres JSON Model service
 */
export class PostgresJsonQueryCompiler {
  /**
   * Statelessly compiles a Travetto WhereClause into a parameterized PostgreSQL WHERE clause.
   */
  static compile<T extends ModelType>(
    modelClass: Class<T>,
    where?: WhereClause<T>,
    tableName?: string,
    checkExpiry = true
  ): CompilationResult {
    const table = tableName ?? PostgresJsonTableManager.getTableName(modelClass);
    const classification = PostgresJsonUtil.classifyFields(modelClass);
    const simpleFieldsSet = new Set(classification.simpleFields.map(f => f.name));
    const ctx: CompilerContext = {
      modelClass,
      tableName: table,
      simpleFieldsSet,
      parameters: []
    };
    const resolvedWhere = ModelQueryUtil.getWhereClause(modelClass, castTo(where), checkExpiry);
    const whereSQL = this.compileClause(ctx, resolvedWhere);
    return {
      whereSQL,
      parameters: ctx.parameters
    };
  }

  /**
   * Statelessly compiles sorting clauses into SQL ORDER BY string.
   */
  static compileSort<T extends ModelType>(modelClass: Class<T>, sort?: SortClause<T>[]): string {
    if (!sort || sort.length === 0) {
      return '';
    }
    const classification = PostgresJsonUtil.classifyFields(modelClass);
    const simpleFieldsSet = new Set(classification.simpleFields.map(f => f.name));
    const ctx: CompilerContext = {
      modelClass,
      tableName: '',
      simpleFieldsSet,
      parameters: []
    };
    const sortClauses = sort.map(sortClause => {
      const key = Object.keys(sortClause)[0];
      const direction = castTo<Record<string, 1 | -1>>(sortClause)[key];
      const path = key.split('.');
      const { sqlPath } = this.resolvePath(ctx, path);
      return `${sqlPath} ${direction === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }

  /**
   * Statelessly resolves a field path to a database SQL expression and retrieves its schema config.
   */
  static resolvePath(ctxOrModelClass: CompilerContext | Class, path: string[]): { sqlPath: string; leafField?: SchemaFieldConfig } {
    let ctx: CompilerContext;
    if (ctxOrModelClass && typeof ctxOrModelClass === 'object' && 'modelClass' in ctxOrModelClass) {
      ctx = ctxOrModelClass;
    } else {
      const classification = PostgresJsonUtil.classifyFields(ctxOrModelClass as Class);
      const simpleFieldsSet = new Set(classification.simpleFields.map(f => f.name));
      ctx = {
        modelClass: ctxOrModelClass as Class,
        tableName: PostgresJsonTableManager.getTableName(ctxOrModelClass as Class),
        simpleFieldsSet,
        parameters: []
      };
    }

    const firstSegment = path[0];

    if (ctx.simpleFieldsSet.has(firstSegment)) {
      if (path.length > 1) {
        throw new Error(`Cannot traverse nested properties under simple column "${firstSegment}" in table "${ctx.tableName}"`);
      }
      const classification = PostgresJsonUtil.classifyFields(ctx.modelClass);
      const leafField = classification.simpleFields.find(field => field.name === firstSegment);
      return { sqlPath: `"${firstSegment}"`, leafField };
    }

    // Traverse schema starting at root model
    let currentField: SchemaFieldConfig | undefined;
    const classification = PostgresJsonUtil.classifyFields(ctx.modelClass);
    currentField = classification.complexFields.find(field => field.name === firstSegment);

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
  static compileClause(ctx: CompilerContext, clause: WhereClause<unknown>): string {
    if (!clause) {
      return '';
    }
    if (ModelQueryUtil.has$And(clause)) {
      const compiled = clause.$and.map(item => this.compileClause(ctx, item)).filter(Boolean);
      return compiled.length ? `(${compiled.join(' AND ')})` : '';
    } else if (ModelQueryUtil.has$Or(clause)) {
      const compiled = clause.$or.map(item => this.compileClause(ctx, item)).filter(Boolean);
      return compiled.length ? `(${compiled.join(' OR ')})` : '';
    } else if (ModelQueryUtil.has$Not(clause)) {
      const compiled = this.compileClause(ctx, clause.$not);
      return compiled ? `NOT (${compiled})` : '';
    } else {
      return this.compileSimple(ctx, clause);
    }
  }

  /**
   * Helper to build JSON template for array of object queries
   */
  static buildJsonTemplate(queryObj: Record<string, unknown>): Record<string, unknown> {
    const template: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(queryObj)) {
      if (v && typeof v === 'object' && v.constructor === Object) {
        const firstKey = Object.keys(v)[0];
        const valObj = castTo<Record<string, unknown>>(v);
        if (firstKey === '$eq') {
          template[k] = valObj.$eq;
        } else if (valObj.$eq !== undefined) {
          template[k] = valObj.$eq;
        } else if (!firstKey.startsWith('$')) {
          template[k] = this.buildJsonTemplate(valObj);
        } else {
          throw new Error(`Unsupported operator ${firstKey} in nested array query`);
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
  static compileSimple(ctx: CompilerContext, item: Record<string, unknown>, parentPath: string[] = []): string {
    if (!item) {
      return '';
    }
    const clauses: string[] = [];

    for (const [key, value] of Object.entries(item)) {
      const currentPath = [...parentPath, key];
      const isPlainObject = value && typeof value === 'object' && value.constructor === Object;
      const firstKey = isPlainObject ? Object.keys(value)[0] : '';

      const { sqlPath, leafField } = this.resolvePath(ctx, currentPath);

      if (leafField?.array && SchemaRegistryIndex.has(leafField.type) && isPlainObject && !firstKey.startsWith('$')) {
        const template = this.buildJsonTemplate(value as Record<string, unknown>);
        const placeholder = `$${ctx.parameters.length + 1}`;
        ctx.parameters.push(JSON.stringify([template]));
        clauses.push(`${sqlPath} @> ${placeholder}::jsonb`);
      } else if (isPlainObject && firstKey.startsWith('$')) {
        clauses.push(this.compileOperator(ctx, currentPath, value as Record<string, unknown>));
      } else if (isPlainObject) {
        clauses.push(this.compileSimple(ctx, value as Record<string, unknown>, currentPath));
      } else {
        clauses.push(this.compileOperator(ctx, currentPath, { $eq: value }));
      }
    }

    return clauses.filter(Boolean).join(' AND ');
  }

  /**
   * Compiles individual operators like $eq, $gt, $in, $regex etc.
   */
  static compileOperator(ctx: CompilerContext, path: string[], operation: Record<string, unknown>): string {
    const { sqlPath, leafField } = this.resolvePath(ctx, path);
    const clauses: string[] = [];

    for (let [operator, value] of Object.entries(operation)) {
      if (Array.isArray(value)) {
        value = value.map(val => ModelQueryUtil.resolveComparator(val));
      } else {
        value = ModelQueryUtil.resolveComparator(value);
      }
      const placeholder = `$${ctx.parameters.length + 1}`;
      let clause = '';

      // Handle JSONB array queries
      if (leafField?.array) {
        if (operator === '$eq') {
          ctx.parameters.push(JSON.stringify([value]));
          clause = `${sqlPath} @> ${placeholder}::jsonb`;
        } else if (operator === '$ne') {
          ctx.parameters.push(JSON.stringify([value]));
          clause = `NOT (${sqlPath} @> ${placeholder}::jsonb)`;
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = '1=0';
          } else {
            const innerClauses = value.map(val => {
              const innerPlaceholder = `$${ctx.parameters.length + 1}`;
              ctx.parameters.push(JSON.stringify([val]));
              return `${sqlPath} @> ${innerPlaceholder}::jsonb`;
            });
            clause = `(${innerClauses.join(' OR ')})`;
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = '1=1';
          } else {
            const innerClauses = value.map(val => {
              const innerPlaceholder = `$${ctx.parameters.length + 1}`;
              ctx.parameters.push(JSON.stringify([val]));
              return `NOT (${sqlPath} @> ${innerPlaceholder}::jsonb)`;
            });
            clause = `(${innerClauses.join(' AND ')})`;
          }
        } else if (operator === '$all') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = '1=0';
          } else {
            ctx.parameters.push(JSON.stringify(value));
            clause = `${sqlPath} @> ${placeholder}::jsonb`;
          }
        } else if (operator === '$exists') {
          clause = value ? `${sqlPath} IS NOT NULL AND ${sqlPath} <> '[]'::jsonb` : `(${sqlPath} IS NULL OR ${sqlPath} = '[]'::jsonb)`;
        } else {
          throw new Error(`Operator "${operator}" is not supported for JSONB arrays`);
        }
      } else {
        // Standard scalar queries
        if (operator === '$eq') {
          if (value === null || value === undefined) {
            clause = `${sqlPath} IS NULL`;
          } else {
            ctx.parameters.push(value);
            clause = `${sqlPath} = ${placeholder}`;
          }
        } else if (operator === '$ne') {
          if (value === null || value === undefined) {
            clause = `${sqlPath} IS NOT NULL`;
          } else {
            ctx.parameters.push(value);
            clause = `${sqlPath} <> ${placeholder}`;
          }
        } else if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
          ctx.parameters.push(value);
          const sqlOperator = operator === '$gt' ? '>' : operator === '$gte' ? '>=' : operator === '$lt' ? '<' : '<=';
          clause = `${sqlPath} ${sqlOperator} ${placeholder}`;
        } else if (operator === '$in') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = '1=0';
          } else {
            const placeholders = value.map(val => {
              const innerPlaceholder = `$${ctx.parameters.length + 1}`;
              ctx.parameters.push(val);
              return innerPlaceholder;
            });
            clause = `${sqlPath} IN (${placeholders.join(', ')})`;
          }
        } else if (operator === '$nin') {
          if (!Array.isArray(value) || value.length === 0) {
            clause = '1=1';
          } else {
            const placeholders = value.map(val => {
              const innerPlaceholder = `$${ctx.parameters.length + 1}`;
              ctx.parameters.push(val);
              return innerPlaceholder;
            });
            clause = `${sqlPath} NOT IN (${placeholders.join(', ')})`;
          }
        } else if (operator === '$exists') {
          clause = value ? `${sqlPath} IS NOT NULL` : `${sqlPath} IS NULL`;
        } else if (operator === '$regex') {
          const regex = value instanceof RegExp ? value : new RegExp(String(value));
          const caseInsensitive = regex.flags.includes('i');
          const regexSource = regex.source.replaceAll('\\b', '\\y');
          ctx.parameters.push(regexSource);
          clause = `${sqlPath} ${caseInsensitive ? '~*' : '~'} ${placeholder}`;
        } else {
          throw new Error(`Operator "${operator}" is not supported for scalar columns`);
        }
      }

      if (clause) {
        clauses.push(clause);
      }
    }

    return clauses.length > 1 ? `(${clauses.join(' AND ')})` : clauses[0] || '';
  }
}
