/* eslint @typescript-eslint/no-unused-vars: ["error", { "args": "none"} ] */
import { DataUtil, ValidationResultError, type ValidationError, SchemaRegistryIndex } from '@travetto/schema';
import { JSONUtil, type Class } from '@travetto/runtime';

import type { ModelQuery, Query, PageableModelQuery } from './model/query.ts';

import { TypeUtil } from './internal/types.ts';

type SimpleType = keyof typeof TypeUtil.OPERATORS;

interface State {
  path: string;
  collect(element: string, message: string): void;
  extend(path: string): State;
  log(error: string): void;
}

interface ProcessingHandler {
  preMember?(state: State, value: unknown): boolean;
  onSimpleType(state: State, type: SimpleType, value: unknown, isArray: boolean): void;
  onComplexType?(state: State, cls: Class, value: unknown, isArray: boolean): boolean | undefined;
}

// const TOP_LEVEL_OPS = new Set(['$and', '$or', '$not']);

const SELECT = 'select';
const WHERE = 'where';
const SORT = 'sort';
// const GROUP_BY = 'groupBy';

const MULTIPLE_KEYS_ALLOWED = new Set([
  '$maxDistance', '$gt', '$gte',
  '$minDistance', '$lt', '$lte',
  '$near'
]);

/**
 * Query verification service.  Used to verify the query is valid before running.
 */
export class QueryVerifier {

  /**
   * Internal mapping for various clauses
   */
  static #mapping = [
    [SELECT, 'processSelectClause'] as const,
    [WHERE, 'processWhereClause'] as const,
    [SORT, 'processSortClause'] as const,
  ];

  /**
   * Handle generic clauses
   */
  static processGenericClause<T>(state: State, cls: Class<T>, clause: object, handler: ProcessingHandler): void {
    const view = SchemaRegistryIndex.getConfig(cls).fields;

    if (clause === undefined || clause === null) {
      state.log('Value cannot be undefined or null');
      return;
    }

    if (handler.preMember && handler.preMember(state, clause)) {
      return;
    }

    for (const [key, value] of Object.entries(clause)) {

      // Validate value is correct, and key is valid
      if (value === undefined || value === null) {
        // state.log(`${key} cannot be undefined or null`);
        continue;
      }

      if (handler.preMember && handler.preMember(state, value)) {
        continue;
      }

      if (!(key in view)) {
        state.log(`Unknown member ${key} of ${cls.name}`);
        continue;
      }

      // Find field
      const field = view[key];
      const type = TypeUtil.getDeclaredType(field);

      // If a simple operation
      if (type) {
        handler.onSimpleType(state.extend(key), type, value, field.array ?? false);
      } else {
        // Otherwise recurse
        const subCls = field.type;
        const subValue = value;
        if (handler.onComplexType && handler.onComplexType(state, subCls, subValue, field.array ?? false)) {
          continue;
        }
        this.processGenericClause(state.extend(key), subCls, subValue, handler);
      }
    }
  }

  /**
   * Ensure types match
   */
  static typesMatch(declared: string, actual: string | undefined): boolean {
    return declared === actual;
  }

  /**
   * Check operator clause
   */
  static checkOperatorClause(state: State, declaredType: SimpleType, value: unknown, allowed: Record<string, Set<string>>, isArray: boolean): void {
    if (isArray && Array.isArray(value)) {
      // Handle array literal
      for (const item of value) {
        this.checkOperatorClause(state, declaredType, item, allowed, false);
      }
      return;
    }

    if (!DataUtil.isPlainObject(value)) {
      // Handle literal
      const actualType = TypeUtil.getActualType(value);
      if (!this.typesMatch(declaredType, actualType)) {
        state.log(`Operator clause only supports types of ${declaredType}, not ${actualType}`);
      }
      return;
    } else {
      const keys = Object.keys(value).toSorted();

      if (keys.length !== 1 && !(
        keys.length >= 2 &&
        MULTIPLE_KEYS_ALLOWED.has(keys[0]) ||
        MULTIPLE_KEYS_ALLOWED.has(keys[1])
      )) {
        state.log('One and only one operation may be specified in an operator clause');
        return;
      }
    }

    // Should only be one?
    for (const [key, keyValue] of Object.entries(value)) {
      if (key === '$all' || key === '$elemMatch' || key === '$in' || key === '$nin') {
        if (!Array.isArray(keyValue)) {
          state.log(`${key} operator requires comparison to be an array, not ${typeof keyValue}`);
          return;
        } else if (keyValue.length === 0) {
          state.log(`${key} operator requires comparison to be a non-empty array`);
          return;
        }

        for (const item of keyValue) {
          const itemType = TypeUtil.getActualType(item);
          if (!this.typesMatch(declaredType, itemType)) {
            state.log(`${key} operator requires all values to be ${declaredType}, but ${itemType} was found`);
            return;
          }
        }
      } else if (!(key in allowed)) {
        state.log(`Operation ${key}, not allowed for field of type ${declaredType}`);
      } else {
        const actualSubType = TypeUtil.getActualType(keyValue)!;

        if (!allowed[key].has(actualSubType)) {
          state.log(`Passed in value ${actualSubType} mismatches with expected type(s) ${Array.from(allowed[key])}`);
        }
      }
    }
  }

  /**
   * Process where clause
   */
  static processWhereClause<T>(st: State, cls: Class<T>, passed: object): void {
    return this.processGenericClause(st, cls, passed, {
      preMember: (state: State, value: Record<string, unknown>) => {
        const keys = Object.keys(value);
        const firstKey = keys[0];

        if (!firstKey) {
          return false;
        }

        const sub = value[firstKey];
        // Verify boolean clauses
        if (firstKey === '$and' || firstKey === '$or') {
          if (!Array.isArray(sub)) {
            state.log(`${firstKey} requires the value to be an array`);
          } else {
            // Iterate
            for (const item of sub) {
              this.processWhereClause(state, cls, item);
            }
            return true;
          }
        } else if (firstKey === '$not') {
          if (DataUtil.isPlainObject(sub)) {
            this.processWhereClause(state, cls, sub);
            return true;
          } else {
            state.log(`${firstKey} requires the value to be an object`);
          }
        }
        return false;
      },
      onSimpleType: (state: State, type: SimpleType, value: unknown, isArray: boolean) => {
        this.checkOperatorClause(state, type, value, TypeUtil.OPERATORS[type], isArray);
      },
      onComplexType: (state: State, subCls: Class<T>, subValue: T, isArray: boolean): boolean => false
    });
  }

  /**
   * Handle group by clause
   */
  static processGroupByClause(state: State, value: object): void {
    // TODO: Handle group by?
  }

  /**
   * Handle sort clause
   */
  static processSortClause<T>(st: State, cls: Class<T>, passed: object): void {
    return this.processGenericClause(st, cls, passed, {
      onSimpleType: (state, type, value) => {
        if (value === 1 || value === -1 || typeof value === 'boolean') {
          return;
        }
        state.log(`Only true, false -1, and 1 are allowed for sorting, not ${JSONUtil.toUTF8(value)}`);
      }
    });
  }

  /**
   * Handle select clause
   */
  static processSelectClause<T>(st: State, cls: Class<T>, passed: object): void {
    return this.processGenericClause(st, cls, passed, {
      onSimpleType: (state, type, value) => {
        const actual = TypeUtil.getActualType(value);
        if (actual === 'number' || actual === 'boolean') {
          if (value === 1 || value === 0 || actual === 'boolean') {
            return;
          }
          state.log('Only true, false 0, and 1 are allowed for including/excluding fields');
        } else {
        /* if (actual === 'string') {
          if (!/[A-Za-z_$0-9]/.test(value)) {
            state.log(`Only A-Z, a-z, 0-9, '$' and '_' are allowed in aliases for selecting fields`);
            return;
          }
          return;
        } else if (isPlainObject(value)) {
          if (!('alias' in value)) {
            state.log('Alias is a required field for selecting');
            return;
          } else {
            // or { alias: string, calc?: string }
            // console.log('Yay');
          }
        */}
        state.log('Only true, false, 0, and 1 are allowed for selecting fields');
      }
    });
  }

  /**
   * Verify the query
   */
  static async verify<T>(cls: Class<T>, query?: ModelQuery<T> | Query<T> | PageableModelQuery<T>): Promise<void> {
    if (!query) {
      return;
    }

    const errors: ValidationError[] = [];

    const state = {
      path: '',
      collect(path: string, message: string): void {
        errors.push({ message: `${path}: ${message}`, path, kind: 'model' });
      },
      log(error: string): void {
        this.collect(this.path, error);
      },
      extend<S extends { path: string }>(this: S, sub: string): S {
        return { ...this, path: !this.path ? sub : `${this.path}.${sub}` };
      }
    };

    // Check all the clauses
    for (const [key, fn] of this.#mapping) {
      if (key === 'sort') {
        continue;
      }

      if (!(key in query)
        || query[key] === undefined
        || query[key] === null
      ) {
        continue;
      }

      const value = query[key];
      const subState = state.extend(key);

      if (Array.isArray(value)) {
        for (const item of value) {
          this[fn](subState, cls, item);
        }
      } else if (typeof value !== 'string') {
        this[fn](subState, cls, value);
      }
    }

    if (errors.length) {
      throw new ValidationResultError(errors);
    }
  }
}