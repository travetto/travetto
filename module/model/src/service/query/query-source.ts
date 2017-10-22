import * as ts from 'typescript';
import { OPERATORS, QUERY_TYPES, ProcessingHandler, SimpleType, ErrorCollector } from './types';


interface ProcessingState {
  passedMemberKey: string;
  passedMembers: Map<string, ts.Symbol>;
  passedMemberType: ts.Type;
  passedMemberSymbol: ts.Symbol;
  passedMemberTypeNode: ts.TypeNode;
  modelMembers: Map<string, ts.Symbol>;
  modelMemberSymbol: ts.Symbol;
  modelMemberTypeNode: ts.TypeNode;
  modelMemberType: ts.Type;
  modelMemberKind: ts.SyntaxKind;
}

export class QuerySourceVerifier {

  cache = new Map<any, Map<string, ts.Symbol>>();

  constructor(private collector: ErrorCollector<ts.Node>, private tc: ts.TypeChecker) {
    this.visitNode = this.visitNode.bind(this);
  }

  getMembersByType(type: ts.Type) {
    if (!this.cache.has(type)) {
      let members = new Map<string, ts.Symbol>();
      for (let symbol of this.tc.getPropertiesOfType(type)) {
        members.set(`${symbol.escapedName}`, symbol);
      }
      this.cache.set(type, members);
    }
    return this.cache.get(type)!;
  }

  visitNode(node: ts.Node): void {
    // sHandle direct invocation
    if (ts.isPropertyDeclaration(node) && node.initializer) {
      this.processQuery(this.tc.getTypeAtLocation(node), node.initializer);
    } else if (ts.isCallExpression(node)) {
      let sig = this.tc.getResolvedSignature(node);
      if (sig) {
        let i = 0;
        for (let n of sig.parameters) {
          this.processQuery((n as any).type, node.arguments[i]);
          i++;
        }
      }
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      this.processQuery(this.tc.getTypeAtLocation(node), node.initializer);
    }
    return ts.forEachChild(node, this.visitNode);
  }

  checkIfArrayType(n: ts.Node) {
    let type = this.tc.getTypeAtLocation(n);
    return ts.isArrayLiteralExpression(n) || ts.isArrayTypeNode(n) || type.symbol!.escapedName === 'Array';
  }

  hasFlags<T extends number>(type: T, ...flags: T[]) {
    let out = 0;
    for (let f of flags) {
      out = out | f;
    }
    return (out & type) > 0;
  }

  checkIfObjectType(n: ts.Node) {
    let type = this.tc.getTypeAtLocation(n);
    return ts.isObjectLiteralExpression(n) || this.hasFlags(type.flags, ts.TypeFlags.Object) && type.symbol!.escapedName !== 'Array';
  }

  checkOperatorClause(target: ts.Node, type: ts.Type, primitiveType: ts.TypeFlags | string, allowed: { [key: string]: Set<string> }) {
    if (!this.hasFlags(type.flags, ts.TypeFlags.Object) || type.symbol!.escapedName === 'Array') {
      if (typeof primitiveType === 'number') {
        if (!this.hasFlags(type.flags, primitiveType)) {
          this.collector.collect(target, `Operator clause only supports types of ${ts.TypeFlags[primitiveType].toLowerCase()}, not ${this.tc.typeToString(type)}`);
        }
      } else {
        let primitiveString = this.tc.typeToString(type);
        if (primitiveType !== primitiveString) {
          this.collector.collect(target, `Operator clause only supports types of ${primitiveType}, not ${primitiveString}`);
        }
      }
      return;
    }

    let members = this.getMembersByType(type);
    if (members.size !== 1) {
      this.collector.collect(target, `One and only one operation may be specified in an operator clause`);
    }
    let [key, value] = members.entries().next().value;
    let passedType = (value as any).type as ts.Type;

    if (!(key in allowed)) {
      this.collector.collect(target, `Operation ${key}, not allowed for field of type ${this.tc.typeToString(passedType)}`);
    } else {
      let passedTypeName = this.tc.typeToString(passedType);
      if (!allowed[key].has(passedTypeName)) {
        this.collector.collect(target, `Passed in value ${passedTypeName} mismatches with expected type(s) ${Array.from(allowed[key])}`);
      }
    }
  }

  processGenericClause(node: ts.Node, model: ts.Type, passed: ts.Type, handler: ProcessingHandler<ProcessingState, ts.Node>) {
    let passedMembers: Map<string, ts.Symbol> = this.getMembersByType(passed);
    let modelMembers: Map<string, ts.Symbol> = this.getMembersByType(model);

    for (let [passedMemberKey, passedMemberSymbol] of passedMembers.entries()) {
      let state: ProcessingState = {
        passedMemberKey,
        passedMembers,
        passedMemberSymbol,
        passedMemberType: (passedMemberSymbol as any).type as ts.Type,
        passedMemberTypeNode: passedMemberSymbol.valueDeclaration!,
        modelMembers,
        modelMemberSymbol: modelMembers.get(passedMemberKey),
      } as any;
      if (state.modelMemberSymbol) {
        state.modelMemberTypeNode = (state.modelMemberSymbol!.valueDeclaration! as any).type;
        state.modelMemberType = this.tc.getTypeFromTypeNode(state.modelMemberTypeNode);
        state.modelMemberKind = state.modelMemberTypeNode.kind;
      }

      if (handler.preMember && handler.preMember(state)) {
        continue;
      }

      if (!state.modelMembers.has(passedMemberKey)) {
        this.collector.collect(node, `Unknown member ${state.passedMemberKey}`);
        continue;
      }

      let op: SimpleType | undefined;

      switch (state.modelMemberKind === ts.SyntaxKind.TypeReference ? state.modelMemberType.symbol!.escapedName : state.modelMemberKind) {
        case ts.SyntaxKind.StringKeyword: op = 'string'; break;
        case ts.SyntaxKind.NumberKeyword: op = 'number'; break;
        case ts.SyntaxKind.BooleanKeyword: op = 'boolean'; break;
        case 'Date': op = 'Date'; break;
        case 'GeoPoint': op = 'GeoPoint'; break;
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
    }
  }

  processWhereClause(node: ts.Node, model: ts.Type, passed: ts.Type) {
    return this.processGenericClause(node, model, passed, {
      preMember: (state: ProcessingState) => {
        if (state.passedMemberKey.charAt(0) === '$') {
          if (state.passedMembers.size > 1) {
            this.collector.collect(state.passedMemberTypeNode, `You can only have one $and, $or, or $not in a single object`);
            return true;
          }

          let n: ts.Node = (state.passedMemberSymbol.valueDeclaration! as any).initializer;

          if (state.passedMemberKey === '$and' || state.passedMemberKey === '$or') {
            if (this.checkIfArrayType(n)) {
              if (ts.isTypeReferenceNode(n)) {
                // bail on deep dive on variables
                return true;
              }
              // Iterate
              let arr = n as ts.ArrayLiteralExpression;
              for (let el of arr.elements) {
                this.processWhereClause(el, model, state.passedMemberType);
              }
            } else {
              this.collector.collect(n, `${state.passedMemberKey} requires the value to be an array`);
            }
          } else if (state.passedMemberKey === '$not') {
            // Not loop
            if (this.checkIfObjectType(n)) {
              if (ts.isTypeReferenceNode(n)) {
                // bail on deep dive on variables
              }

              this.processWhereClause(node, model, state.passedMemberType);
            } else {
              this.collector.collect(n, `${state.passedMemberKey} requires the value to be an object`);
            }
          } else {
            this.collector.collect(state.passedMemberTypeNode, `Unknown high level operator ${state.passedMemberKey}`);
            // Error
          }
          return true;
        }
      },

      onSimpleType: (state: ProcessingState, type: string) => {
        let conf = OPERATORS[type];
        this.checkOperatorClause(state.passedMemberTypeNode, state.passedMemberType, conf.type, conf.ops);
      },

      onArrayType: (state: ProcessingState, target: ts.Type) => {
        if (state.passedMemberKey === '$subMatch') { //

        }

        let typeStr = this.tc.typeToString(state.modelMemberType);
        if (this.hasFlags(target.flags, ts.TypeFlags.String, ts.TypeFlags.Boolean, ts.TypeFlags.Number)) {
          typeStr = typeStr.toLowerCase();
        }

        this.checkOperatorClause(state.passedMemberTypeNode, state.passedMemberType, typeStr, { $all: new Set([typeStr]) });
      }
    });
  }

  processGroupByClause(node: ts.Node, model: ts.Type, member: ts.Type) {

  }

  isLiteral(node: ts.Node) {
    return node.kind === ts.SyntaxKind.PrefixUnaryExpression || node.kind === ts.SyntaxKind.LiteralType;
  }

  getLiteralText(node: ts.Node) {
    return node.getText();
  }

  processSortClause(node: ts.Node, model: ts.Type, member: ts.Type) {
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
  }

  processSelectClause(node: ts.Node, model: ts.Type, member: ts.Type) {
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
  }

  processQuery(queryType: ts.Type, passedNode: ts.Node) {
    if (queryType && queryType.aliasSymbol) {
      let queryName = `${queryType.aliasSymbol.escapedName}`;

      if (QUERY_TYPES[queryName] && queryType.aliasTypeArguments && queryType.aliasTypeArguments.length) {
        let modelType = queryType.aliasTypeArguments[0];

        let members = this.getMembersByType(queryType)

        if (members && members.size) {
          let passedType = this.tc.getTypeAtLocation(passedNode);
          let passedMembers = this.getMembersByType(passedType);
          for (let k of ['select', 'where', 'groupBy', 'sort']) {
            if (members.has(k) && passedMembers.has(k)) {
              const fn: keyof this = `process${k.charAt(0).toUpperCase()}${k.substring(1)}Clause` as any;
              const type = (passedMembers.get(k)! as any).type;
              const node = ((passedMembers.get(k)!.valueDeclaration!) as any).initializer;

              if (ts.isArrayLiteralExpression(node)) {
                for (let child of node.elements) {
                  this[fn](child, modelType, this.tc.getTypeAtLocation(child));
                }
              } else {
                this[fn](passedNode, modelType, type);
              }
            }
          }
        }
      }
    }
  }
}