import { ModelQuery, Query, PageableModelQuery, GroupClause, WhereClause } from '../../model';
import { Class } from '@travetto/registry';
import { SimpleType, ErrorCollector, OPERATORS, TypeUtil } from './types';
import { SchemaRegistry, SchemaConfig, ViewConfig, FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { BaseError, isPlainObject } from '@travetto/base';
import { ValidationErrors } from './error';

interface State extends ErrorCollector<string> {
  path: string;
  extend(path: string): State;
  log(err: string): void;
}

interface ProcessingHandler {
  preMember?(state: State, value: any): boolean;
  onSimpleType(state: State, type: SimpleType, value: any, isArray: boolean): void;
  onComplexType?(state: State, cls: Class<any>, value: any, isArray: boolean): boolean | undefined;
}

const $AND = '$and';
const $OR = '$or';
const $NOT = '$not';
const $ALL = '$all';
const $ELEM_MATCH = '$elemMatch';

const TOP_LEVEL_OPS = new Set([$AND, $OR, $NOT]);

const SELECT = 'select';
const WHERE = 'where';
const SORT = 'sort';
const GROUP_BY = 'groupBy';

@Injectable()
export class QueryVerifierService {

  private mapping = [
    [SELECT, this.processSelectClause.bind(this)],
    [WHERE, this.processWhereClause.bind(this)],
    [SORT, this.processSortClause.bind(this)],
    [GROUP_BY, this.processGroupByClause.bind(this)]
  ] as [
    keyof Query<any>,
    (state: State, cls: Class, val: any) => any
  ][];

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

      if (value === undefined || value === null) {
        state.log(`${key} cannot be undefined or null`);
        continue;
      }

      if (handler.preMember && handler.preMember(state, value)) {
        continue;
      }

      if (!(key in view.schema)) {
        state.log(`Unknown member ${key} of ${cls.name}`);
        continue;
      }

      const field = view.schema[key];
      const op = TypeUtil.getDeclaredType(field);

      if (op) {
        handler.onSimpleType(state.extend(key), op, value, field.declared.array);
      } else {
        const subCls = field.declared.type;
        const subVal = value;
        if (handler.onComplexType && handler.onComplexType(state, subCls, subVal, field.declared.array)) {
          continue;
        }
        this.processGenericClause(state.extend(key), subCls, subVal, handler);
      }
    }
  }

  typesMatch(declared: string, actual: string | undefined) {
    return declared === actual;
  }

  checkOperatorClause(state: State, declaredType: SimpleType, value: any, allowed: { [key: string]: Set<string> }, isArray: boolean) {

    if (isArray) {
      if (Array.isArray(value)) {
        // Handle array literal
        for (const el of value) {
          this.checkOperatorClause(state, declaredType, el, allowed, false);
        }
        return;
      }
    }

    if (!isPlainObject(value)) {
      // Ha ndle literal
      const actualType = TypeUtil.getActualType(value);
      if (!this.typesMatch(declaredType, actualType)) {
        state.log(`Operator clause only supports types of ${declaredType}, not ${actualType}`);
      }
      return;
    } else if (Object.keys(value).length !== 1) {
      state.log(`One and only one operation may be specified in an operator clause`);
      return;
    }

    // Should only be one?
    for (const [k, v] of Object.entries(value)) {

      if (isArray && (k === $ALL || k === $ELEM_MATCH)) {
        if (k === $ALL) {
          if (!Array.isArray(v)) {
            state.log(`$all operator requires comparison to be an array, not ${typeof v}`);
            return;
          } else {
            for (const el of v) {
              const elAct = TypeUtil.getActualType(el);
              if (!this.typesMatch(declaredType, elAct)) {
                state.log(`$all operator requires all values to be ${declaredType}, but ${elAct} was found`);
                return;
              }
            }
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

  processWhereClause<T>(st: State, cls: Class<T>, passed: object) {
    return this.processGenericClause(st, cls, passed, {
      preMember: (state: State, value: any) => {
        const keys = Object.keys(value);
        const firstKey = keys[0];

        if (!firstKey) {
          return false;
        }

        const sub = value[firstKey];

        if (firstKey === $AND || firstKey === $OR) {
          if (!Array.isArray(sub)) {
            state.log(`${firstKey} requires the value to be an array`);
          } else {
            // Iterate
            for (const el of sub) {
              this.processWhereClause(state, cls, el);
            }
            return true;
          }
        } else if (firstKey === $NOT) {
          if (isPlainObject(sub)) {
            this.processWhereClause(state, cls, sub);
            return true;
          } else {
            state.log(`${firstKey} requires the value to be an object`);
          }
        }
        return false;
      },
      onSimpleType: (state: State, type: SimpleType, value: any, isArray: boolean) => {
        this.checkOperatorClause(state, type, value, OPERATORS[type], isArray);
      },
      onComplexType: (state: State, subCls: Class<T>, subVal: T, isArray: boolean): boolean => {
        return false;
      }
    });
  }

  processGroupByClause(state: State, vlue: object) {

  }

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

  processSelectClause<T>(st: State, cls: Class<T>, passed: object) {
    return this.processGenericClause(st, cls, passed, {
      onSimpleType: (state, type, value) => {
        const actual = TypeUtil.getActualType(value);
        if (actual === 'number' || actual === 'boolean') {
          if (value === 1 || value === 0 || actual === 'boolean') {
            return;
          }
          state.log(`Only true, false 0, and 1 are allowed for including/excluding fields`);
        } else if (actual === 'string') {
          if (!/[A-Za-z_$0-9]/.test(value)) {
            state.log(`Only A-Z, a-z, 0-9, '$' and '_' are allowed in aliases for selecting fields`);
            return;
          }
          return;
        } else if (isPlainObject(value)) {
          if (!('alias' in value)) {
            state.log(`Alias is a required field for selecting`);
            return;
          } else {
            // console.log('Yay');
          }
        }
        state.log(`Only true, false -1, and 1 or { alias: string, calc?: string } are allowed for selecting fields`);
      }
    });
  }

  verify<T>(cls: Class<T>, query: ModelQuery<T> | Query<T> | PageableModelQuery<T>) {
    const errors: { message: string, path: string }[] = [];

    const state = {
      path: '',
      collect(path: string, message: string) {
        errors.push({ message: `${path}: ${message}`, path });
      },
      log(err: string) {
        this.collect(this.path, err);
      },
      extend(sub: string) {
        return { ...this, path: !this.path ? sub : `${this.path}.${sub}` };
      }
    }
    for (const [key, fn] of this.mapping) {
      if (!(key in query)) {
        continue;
      }

      const val = (query as Query<any>)[key];
      const subState = state.extend(key);

      if (Array.isArray(val) && key === SORT) {
        for (const el of val) {
          fn(subState, cls, el);
        }
      } else {
        fn(subState, cls, val);
      }
    }

    if (errors.length) {
      throw new ValidationErrors(errors);
    }
  }
}