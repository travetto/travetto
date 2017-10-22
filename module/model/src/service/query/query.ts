import { ModelQuery, Query, PageableModelQuery } from '../../model';
import { Class } from '@travetto/registry';
import { SimpleType, ErrorCollector, OPERATORS } from './types';
import { SchemaRegistry, SchemaConfig, ViewConfig, FieldConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import * as _ from 'lodash';

interface State extends ErrorCollector<string> {
  path: string;
  extend(path: string): State;
  log(err: string): void;
}

interface ProcessingHandler {
  preMember?(state: State, value: any): boolean;
  onSimpleType(state: State, type: SimpleType, value: any): void;
  onArrayType?(state: State, type: SimpleType, value: any): void;
  onComplexType?(state: State, cls: Class<any>, value: any): boolean | undefined;
}

@Injectable()
export class QueryVerifierService {

  getDeclaredType(f: FieldConfig) {
    let type = f.declared.type;
    if (type === String) {
      return 'string';
    } else if (type === Number) {
      return 'number';
    } else if (type === Boolean) {
      return 'boolean';
    } else if (type === Date) {
      return 'Date';
    } else if (f.declared.array && type === Number) {
      return 'GeoPoint';
    }
    throw new Error(`Unknown type: ${f.type.name}`);
  }

  getActualType(v: any) {
    if (v instanceof String) {
      return 'string';
    } else if (v instanceof Number) {
      return 'number';
    } else if (v instanceof Boolean) {
      return 'boolean';
    } else if (v instanceof Date) {
      return 'Date';
    } else if (Array.isArray(v) && v.length === 2 && typeof v[0] === typeof v[1] && typeof v[0] === 'number') {
      return 'GeoPoint';
    }
  }

  processGenericClause<T>(state: State, cls: Class<T>, val: object, handler: ProcessingHandler) {

    let view = SchemaRegistry.getViewSchema(cls);

    for (let key of Object.keys(val)) {

      if (handler.preMember && handler.preMember(state)) {
        continue;
      }

      if (!(key in view.schema)) {
        state.log(`Unknown member ${key} of ${cls.name}`);
        continue;
      }

      let field = view.schema[key];
      let value = (val as any)[key];
      let op: SimpleType | undefined = this.getDeclaredType(field);

      if (op) {
        handler.onSimpleType(state, op, value);
      } else {
        let subCls = field.declared.type;
        let subVal = value;
        if (handler.onComplexType && handler.onComplexType(state, subCls, subVal)) {
          continue;
        }
        this.processGenericClause(state.extend(key), subCls, subVal, handler);
      }
    }
  }

  checkOperatorClause(state: State, declaredType: SimpleType, value: any, allowed: { [key: string]: Set<string> }) {
    if (!_.isPlainObject(value)) {
      let actualType = this.getActualType(value);
      if (declaredType !== actualType) {
        state.log(`Operator clause only supports types of ${declaredType}, not ${actualType}`);
      }
      return;
    } else if (Object.keys(value).length !== 1) {
      state.log(`One and only one operation may be specified in an operator clause`);
    }

    for (let [k, v] of Object.entries(value)) {
      if (!(k in allowed)) {
        state.log(`Operation ${k}, not allowed for field of type ${declaredType}`);
      } else {
        let actualSubType = this.getActualType(v)!;
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

        if (_.isPlainObject(value)) {
          if (firstKey.charAt(0) === '$') {
            if (keys.length !== 1 || ['$and', '$or', '$not'].includes(firstKey)) {
              state.log(`${firstKey} is not supported as a top level opeartor`);
              return false;
            }
          }
        }

        if (firstKey === '$and' || firstKey === '$or') {
          if (!Array.isArray(value[firstKey])) {
            state.log(`${firstKey} requires the value to be an array`);
            return false;
          }
          // Iterate
          for (let el of value[firstKey]) {
            this.processWhereClause(state, cls, el);
          }
        } else if (firstKey === '$not') {
          if (_.isPlainObject(value[firstKey])) {
            this.processWhereClause(st, cls, value[firstKey]);
          } else {
            state.log(`${firstKey} requires the value to be an object`);
            return false;
          }
        }

        return true;
      },
      onSimpleType: (state: State, type: SimpleType, value: any) => {
        let conf = OPERATORS[type];
        this.checkOperatorClause(state, value, conf.type, conf.ops);
      },

      onArrayType: (state: State, type: SimpleType, value: any) => {
        //if (firstKey === '$subMatch') { //

        //}

        // let typeStr = this.tc.typeToString(state.modelMemberType);
        // if (this.hasFlags(target.flags, ts.TypeFlags.String, ts.TypeFlags.Boolean, ts.TypeFlags.Number)) {
        //   typeStr = typeStr.toLowerCase();
        // }

        // this.checkOperatorClause(state.passedMemberTypeNode, state.passedMemberType, typeStr, { $all: new Set([typeStr]) });
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
        let actual = this.getActualType(value);
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
            console.log('Yay');
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
        errors.push({ message: `${path}: ${message}` })
      },
      log(err: string) {
        this.collect(this.path, err);
      },
      extend(sub: string) {
        return { ...this, path: !this.path ? sub : `${this.path}.${sub}` };
      }
    }
    for (let x of ['select', 'where', 'sort', 'groupBy']) {
      if (!(x in query)) {
        continue;
      }

      const fn: keyof this = `process${x.charAt(0).toUpperCase()}${x.substring(1)}Clause` as any;
      const val = (query as any)[x];

      if (Array.isArray(val) && x === 'sort') {
        for (let el of val) {
          this[fn](state, cls, el);
        }
      } else {
        this[fn](state, cls, val);
      }
    }

    if (errors.length) {
      throw { errors };
    }
  }
}