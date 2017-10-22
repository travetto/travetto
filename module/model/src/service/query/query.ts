import { ModelQuery, Query, PageableModelQuery } from '../../model';
import { Class } from '@travetto/registry';
import { SimpleType, ErrorCollector } from './types';
import { SchemaRegistry, SchemaConfig, ViewConfig } from '@travetto/schema';
import { Injectable } from '@travetto/di';

interface State<T> {
  cls: Class<T>;
  schema: ViewConfig;
  collector: ErrorCollector<{ path: string }>;
  path: string;
}

interface ProcessingHandler {
  preMember?(state: State<any>): boolean;
  onSimpleType(state: State<any>, type: SimpleType, value: any): void;
  onArrayType(state: State<any>, type: SimpleType, value: any): void;
  onComplexType?(state: State<any>): boolean | undefined;
}

@Injectable()
export class QueryVerifierService {

  processGenericClause<T>(state: State<T>, val: object, handler: ProcessingHandler) {
    for (let key of Object.keys(val)) {
      if (handler.preMember && handler.preMember(state)) {
        continue;
      }

      if (!(key in state.schema)) {
        state.collector.collect({ path: key }, `Unknown member ${key} of ${state.cls.name}`);
        continue;
      }

      let op: SimpleType | undefined;

      let field = state.schema.schema[key];

      console.log(field);

      /*
          switch (state.modelMemberKind === ts.SyntaxKind.TypeReference ? state.modelMemberType.symbol!.escapedName : state.modelMemberKind) {
            case ts.SyntaxKind.StringKeyword: op = 'string'; break;
            case ts.SyntaxKind.NumberKeyword: op = 'number'; break;
            case ts.SyntaxKind.BooleanKeyword: op = 'boolean'; break;
            case 'Date': op = 'date'; break;
            case 'GeoPoint': op = 'geo'; break;
            case ts.SyntaxKind.ArrayType: {
              if (handler.onArrayType) {
                handler.onArrayType(state, (state.modelMemberType as any).typeArguments[0]);
                continue;
              }
            }
          }
  
        if (op) {
          handler.onSimpleType(state, op, (state.passedMemberSymbol.valueDeclaration as any).initializer as ts.Node);
        } else {
          if (handler.onComplexType && handler.onComplexType(state)) {
            continue;
          }
          this.processGenericClause(node, state.modelMemberType, state.passedMemberType, handler);
        }
      }*/
    }
  }

  processWhereClause<T>(st: State<T>, passed: object) {
    return this.processGenericClause(st, passed, {
      onSimpleType(state: State<any>, type: SimpleType, value: any) {
        //let conf = QuerySourceVerifier.OPERATORS[type];
        //this.checkOperatorClause(state.passedMemberTypeNode, state.passedMemberType, conf.type, conf.ops);
      },

      onArrayType(state: State<any>, type: SimpleType, value: any) {
        // if (state.passedMemberKey === '$subMatch') { //

        // }

        // let typeStr = this.tc.typeToString(state.modelMemberType);
        // if (this.hasFlags(target.flags, ts.TypeFlags.String, ts.TypeFlags.Boolean, ts.TypeFlags.Number)) {
        //   typeStr = typeStr.toLowerCase();
        // }

        // this.checkOperatorClause(state.passedMemberTypeNode, state.passedMemberType, typeStr, { $all: new Set([typeStr]) });
      }
    });
  }

  processGroupByClause<T>(state: State<T>, vlue: object) {

  }

  processSortClause<T>(state: State<T>, passed: object) {
    /*
    return this.processGenericClause(node, model, member, {
      onSimpleType: (state, type, value) => {
        if (this.hasFlags(state.passedMemberType.flags, ts.TypeFlags.Number, ts.TypeFlags.Boolean)) {
          if (this.isLiteral(value)) {
            if (['1', '-1', 'true', 'false'].includes(this.getLiteralText(value))) {
              return;
            }
          } else {
            return;
          }
        }
        this.collector.collect(state.passedMemberTypeNode, `Only true, false -1, and 1 are allowed for sorting, not ${this.getLiteralText(value)}`);
      }
    });
    */
  }

  processSelectClause<T>(state: State<T>, passed: object) {
    /*
    return this.processGenericClause(node, model, member, {
      onSimpleType: (state, type, value) => {
        if (this.hasFlags(state.passedMemberType.flags, ts.TypeFlags.Number, ts.TypeFlags.Boolean)) {
          if (this.isLiteral(value)) {
            if (['1', '0', 'true', 'false'].includes(this.getLiteralText(value))) {
              return;
            }
            this.collector.collect(value, `Only true, false 0, and 1 are allowed for including/excluding fields`);
          } else {
            return;
          }
        } else if (this.hasFlags(state.passedMemberType.flags, ts.TypeFlags.String)) {
          if (this.isLiteral(value) && !/[A-Za-z_$0-9]/.test(this.getLiteralText(value))) {
            this.collector.collect(value, `Only A-Z, a-z, 0-9, '$' and '_' are allowed in aliases for selecting fields`);
            return;
          }
          return;
        } else if (this.checkIfObjectType(state.passedMemberTypeNode) && !ts.isTypeReferenceNode(state.passedMemberTypeNode)) {
          let sub = state.passedMemberType;
          let subMembers = this.getMembersByType(sub);
  
          if (!subMembers.has('alias')) {
            this.collector.collect(state.passedMemberTypeNode, `Alias is a required field for selecting`);
            return;
          } else {
            console.log('Yay');
          }
        }
        this.collector.collect(state.passedMemberTypeNode, `Only true, false -1, and 1 or { alias: string, calc?: string } are allowed for selecting fields`);
      }
    });
    */
  }

  verify<T>(cls: Class<T>, query: ModelQuery<T> | Query<T> | PageableModelQuery<T>) {
    let schema = SchemaRegistry.getViewSchema(cls);
    let errors: any[] = [];
    let state = {
      schema,
      cls,
      collector(type: { path: string }, message: string) {
        errors.push({ path: type.path, message })
      }
    }

    for (let x of ['select', 'where', 'sort', 'groupBy']) {
      const fn: keyof this = `process${x.charAt(0).toUpperCase}${x.substring(1)}Clause` as any;
      const val = (query as any)[x];
      console.log(fn);
      if (Array.isArray(val)) {
        for (let el of val) {
          this[fn](state, el);
        }
      } else {
        this[fn](state, val);
      }
    }

    if (errors.length) {
      throw { errors };
    }
  }
}