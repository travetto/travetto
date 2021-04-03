import { SchemaRegistry, ValidationResultError, ValidationError } from '@travetto/schema';
import { Class, Util } from '@travetto/base';

import { ModelQuery, Query, PageableModelQuery } from '../../model/query';

import { TypeUtil } from '../util/types';


type SimpleType = keyof typeof TypeUtil.OPERATORS;

interface State {
  path: string;
  collect(element: string, message: string): void;
  extend(path: string): State;
  log(err: string): void;
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
  '$maxDistance', '$gt',
  '$minDistance', '$lt',
  '$near'
]);

/**
 * Query verification service.  Used to verify the query is valid before running.
 */
class $QueryVerifier {

  /**
   * Internal mapping for various clauses
   */
  #mapping = [
    [SELECT, 'processSelectClause'] as const,
    [WHERE, 'processWhereClause'] as const,
    [SORT, 'processSortClause'] as const,
  ];

  /**
   * Handle generic clauses
   */
  processGenericClause<T>(state: State, cls: Class<T>, val: object, handler: ProcessingHandler) {
    const view = SchemaRegistry.getViewSchema(cls);

    if (val === undefined || val === null) {
      state.log('Value cannot be undefined or null');
      return;
    }

    if (handler.preMember && handler.preMember(state, val)) {
      return;
    }

    for (const [key, value] of Object.entries(val)) {

      // Validate value is correct, and key is valid
      if (value === undefined || value === null) {
        // state.log(`${key} cannot be undefined or null`);
        continue;
      }

      if (handler.preMember && handler.preMember(state, value)) {
        continue;
      }

      if (!(key in view.schema)) {
        state.log(`Unknown member ${key} of ${cls.name}`);
        continue;
      }

      // Find field
      const field = view.schema[key];
      const op = TypeUtil.getDeclaredType(field);

      // If a simple operation
      if (op) {
        handler.onSimpleType(state.extend(key), op, value, field.array);
      } else {
        // Otherwise recurse
        const subCls = field.type;
        const subVal = value;
        if (handler.onComplexType && handler.onComplexType(state, subCls, subVal, field.array)) {
          continue;
        }
        this.processGenericClause(state.extend(key), subCls, subVal, handler);
      }
    }
  }

  /**
   * Ensure types match
   */
  typesMatch(declared: string, actual: string | undefined) {
    return declared === actual;
  }

  /**
   * Check operator clause
   */
  checkOperatorClause(state: State, declaredType: SimpleType, value: unknown, allowed: Record<string, Set<string>>, isArray: boolean) {
    if (isArray) {
      if (Array.isArray(value)) {
        // Handle array literal
        for (const el of value) {
          this.checkOperatorClause(state, declaredType, el, allowed, false);
        }
        return;
      }
    }

    if (!Util.isPlainObject(value)) {
      // Handle literal
      const actualType = TypeUtil.getActualType(value);
      if (!this.typesMatch(declaredType, actualType)) {
        state.log(`Operator clause only supports types of ${declaredType}, not ${actualType}`);
      }
      return;
    } else {
      const keys = Object.keys(value).sort();

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
    for (const [k, v] of Object.entries(value)) {
      if (k === '$all' || k === '$elemMatch' || k === '$in' || k === '$nin') {
        if (!Array.isArray(v)) {
          state.log(`${k} operator requires comparison to be an array, not ${typeof v}`);
          return;
        } else if (v.length === 0) {
          state.log(`${k} operator requires comparison to be a non-empty array`);
          return;
        }

        for (const el of v) {
          const elAct = TypeUtil.getActualType(el);
          if (!this.typesMatch(declaredType, elAct)) {
            state.log(`${k} operator requires all values to be ${declaredType}, but ${elAct} was found`);
            return;
          }
        }
      } else if (!(k in allowed)) {
        state.log(`Operation ${k}, not allowed for field of type ${declaredType}`);
      } else {
        const actualSubType = TypeUtil.getActualType(v)!;

        if (!allowed[k].has(actualSubType)) {
          state.log(`Passed in value ${actualSubType} mismatches with expected type(s) ${Array.from(allowed[k])}`);
        }
      }
    }
  }

  /**
   * Process where clause
   */
  processWhereClause<T>(st: State, cls: Class<T>, passed: object) {
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
            for (const el of sub) {
              this.processWhereClause(state, cls, el);
            }
            return true;
          }
        } else if (firstKey === '$not') {
          if (Util.isPlainObject(sub)) {
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
      onComplexType: (state: State, subCls: Class<T>, subVal: T, isArray: boolean): boolean => false
    });
  }

  /**
   * Handle group by clause
   */
  processGroupByClause(state: State, value: object) {

  }

  /**
   * Handle sort clause
   */
  processSortClause<T>(st: State, cls: Class<T>, passed: object) {
    return this.processGenericClause(st, cls, passed, {
      onSimpleType: (state, type, value) => {
        if (value === 1 || value === -1 || typeof value === 'boolean') {
          return;
        }
        state.log(`Only true, false -1, and 1 are allowed for sorting, not ${JSON.stringify(value)}`);
      }
    });
  }

  /**
   * Handle select clause
   */
  processSelectClause<T>(st: State, cls: Class<T>, passed: object) {
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
  verify<T>(cls: Class<T>, query: ModelQuery<T> | Query<T> | PageableModelQuery<T>) {
    const errors: ValidationError[] = [];

    const state = {
      path: '',
      collect(path: string, message: string) {
        errors.push({ message: `${path}: ${message}`, path, kind: 'model' });
      },
      log(err: string) {
        this.collect(this.path, err);
      },
      extend(sub: string) {
        return { ...this, path: !this.path ? sub : `${this.path}.${sub}` };
      }
    };

    // Check all the clauses
    for (const [key, fn] of this.#mapping) {
      if (!(key in query)
        || query[key as keyof typeof query] === undefined
        || query[key as keyof typeof query] === null
      ) {
        continue;
      }

      const val = (query as Query<unknown>)[key];
      const subState = state.extend(key);

      if (Array.isArray(val)) {
        for (const el of val) {
          this[fn](subState, cls, el);
        }
      } else {
        this[fn](subState, cls, val as object);
      }
    }

    if (errors.length) {
      throw new ValidationResultError(errors);
    }
  }
}

export const QueryVerifier = new $QueryVerifier();