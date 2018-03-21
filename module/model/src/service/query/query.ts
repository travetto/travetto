import { ModelQuery, Query, PageableModelQuery } from '../../model';
import { Class } from '@travetto/registry';
import { SimpleType, ErrorCollector, OPERATORS, TypeUtil } from './types';
import { SchemaRegistry, SchemaConfig, ViewConfig, FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import * as _ from 'lodash';
import { BaseError } from '@travetto/base';

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

const SELECT = 'select';
const WHERE = 'where';
const SORT = 'sort';
const GROUP_BY = 'groupBy';

class ValidationError extends BaseError {
  constructor(public errors: any[]) {
    super('Validation Error');
  }
}

@Injectable()
export class QueryVerifierService {

  processGenericClause<T>(state: State, cls: Class<T>, val: object, handler: ProcessingHandler) {

    let view = SchemaRegistry.getViewSchema(cls);

    for (let [key, value] of Object.entries(val)) {

      if (handler.preMember && handler.preMember(state, value)) {
        continue;
      }

      if (!(key in view.schema)) {
        state.log(`Unknown member ${key} of ${cls.name}`);
        continue;
      }

      let field = view.schema[key];
      let op = TypeUtil.getDeclaredType(field);

      if (op) {
        handler.onSimpleType(state, op, value, field.declared.array);
      } else {
        let subCls = field.declared.type;
        let subVal = value;
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
        for (let el of value) {
          this.checkOperatorClause(state, declaredType, el, allowed, false);
        }
        return;
      }
    }

    if (!_.isPlainObject(value)) {
      // Handle literal
      let actualType = TypeUtil.getActualType(value);
      if (!this.typesMatch(declaredType, actualType)) {
        state.log(`Operator clause only supports types of ${declaredType}, not ${actualType}`);
      }
      return;
    } else if (Object.keys(value).length !== 1) {
      state.log(`One and only one operation may be specified in an operator clause`);
      return;
    }

    // Should only be one?
    for (let [k, v] of Object.entries(value)) {

      if (isArray && (k === $ALL || k === $ELEM_MATCH)) {
        if (k === $ALL) {
          if (!Array.isArray(v)) {
            state.log(`$all operator requires comparison to be an array, not ${typeof v}`);
            return;
          } else {
            for (let el of v) {
              let elAct = TypeUtil.getActualType(el);
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
        let actualSubType = TypeUtil.getActualType(v)!;

        if (!allowed[k].has(actualSubType)) {
          state.log(`Passed in value ${actualSubType} mismatches with expected type(s) ${Array.from(allowed[k])}`);
        }
      }
    }
  }

  processWhereClause<T>(st: State, cls: Class<T>, passed: object) {
    return this.processGenericClause(st, cls, passed, {
      preMember: (state: State, value: any) => {
        let keys = Object.keys(value);
        let firstKey = keys[0];

        if (!firstKey) {
          return false;
        }

        let sub = value[firstKey];

        if (_.isPlainObject(value)) {
          if (firstKey.charAt(0) === '$') {
            if (keys.length !== 1 || [$AND, $OR, $NOT].includes(firstKey)) {
              state.log(`${firstKey} is not supported as a top level opeartor`);
              return true;
            }
          }
        }

        if (firstKey === $AND || firstKey === $OR) {
          if (!Array.isArray(sub)) {
            state.log(`${firstKey} requires the value to be an array`);
          } else {
            // Iterate
            for (let el of sub) {
              this.processWhereClause(state, cls, el);
            }
            return true;
          }
        } else if (firstKey === $NOT) {
          if (_.isPlainObject(sub)) {
            this.processWhereClause(st, cls, sub);
            return true;
          } else {
            state.log(`${firstKey} requires the value to be an object`);
          }
        }
        return false;
      },
      onSimpleType: (state: State, type: SimpleType, value: any, isArray: boolean) => {
        let conf = OPERATORS[type];
        this.checkOperatorClause(state, value, conf.type, conf.ops, isArray);
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
        if (value === 1 || value === -1 || value === false || value === true) {
          return;
        }
        state.log(`Only true, false -1, and 1 are allowed for sorting, not ${JSON.stringify(value)}`);
      }
    });
  }

  processSelectClause<T>(st: State, cls: Class<T>, passed: object) {
    return this.processGenericClause(st, cls, passed, {
      onSimpleType: (state, type, value) => {
        let actual = TypeUtil.getActualType(value);
        if (actual === 'number' || actual === 'boolean') {
          if (value === 1 || value === 0 || value === true || value === false) {
            return;
          }
          state.log(`Only true, false 0, and 1 are allowed for including/excluding fields`);
        } else if (actual === 'string') {
          if (!/[A-Za-z_$0-9]/.test(value)) {
            state.log(`Only A-Z, a-z, 0-9, '$' and '_' are allowed in aliases for selecting fields`);
            return;
          }
          return;
        } else if (_.isPlainObject(value)) {
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
    let errors: any[] = [];

    let state = {
      path: '',
      collect(path: string, message: string) {
        errors.push({ message: `${path}: ${message}` });
      },
      log(err: string) {
        this.collect(this.path, err);
      },
      extend(sub: string) {
        return { ...this, path: !this.path ? sub : `${this.path}.${sub}` };
      }
    }
    for (let x of [SELECT, WHERE, SORT, GROUP_BY]) {
      if (!(x in query)) {
        continue;
      }

      const fn: keyof this = `process${x.charAt(0).toUpperCase()}${x.substring(1)}Clause` as any;
      const val = (query as any)[x];

      if (Array.isArray(val) && x === SORT) {
        for (let el of val) {
          (this[fn] as any)(state, cls, el);
        }
      } else {
        (this[fn] as any)(state, cls, val);
      }
    }

    if (errors.length) {
      let ret = new Error('Validation errors');
      (ret as any).errors = errors;
      throw new ValidationError(errors);
    }
  }
}