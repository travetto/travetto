import * as ts from 'typescript';
import * as Lint from 'tslint';

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

interface ProcessingHandler {
  preMember?(state: ProcessingState): boolean | undefined;
  onSimpleType(state: ProcessingState, type: string, value: ts.Node): void;
  onArrayType?(state: ProcessingState, target: ts.Type): void;
  onComplexType?(state: ProcessingState): boolean | undefined;
}

export class Rule extends Lint.Rules.TypedRule {

  public static metadata: Lint.IRuleMetadata = {
    ruleName: 'verify-model-query',
    description: 'When creating a query with @travetto/model, this rule will verify the query matches the object structure',
    optionsDescription: 'Not configurable.',
    options: null,
    optionExamples: [true],
    type: 'functionality',
    typescriptOnly: true,
    requiresTypeInfo: true,
  };

  public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
    return this.applyWithFunction(sourceFile, (ctx: Lint.WalkContext<void>, tc: ts.TypeChecker) => {
      return new QueryHandler(ctx, tc).visitNode(ctx.sourceFile);
    }, undefined, program.getTypeChecker());
  }
}

class QueryHandler {

  static QUERY_TYPES = [
    'Query', 'ModelQuery', 'PageableModelQuery'
  ].reduce((acc, v) => { acc[v] = true; return acc; }, {} as { [key: string]: boolean });

  static OPERATORS: { [key: string]: { type: string | number, ops: { [key: string]: Set<string> } } } = {
    string: {
      type: ts.TypeFlags.String,
      ops: {
        $ne: new Set(['string']), $eq: new Set(['string']),
        $exists: new Set(['boolean']), $in: new Set(['string[]']),
        $nin: new Set(['string[]']), $regex: new Set(['string', 'RegEx'])
      }
    },
    number: {
      type: ts.TypeFlags.Number,
      ops: {
        $ne: new Set(['number']), $eq: new Set(['number']),
        $exists: new Set(['boolean']), $in: new Set(['number[]']), $nin: new Set(['number[]']),
        $lt: new Set(['number']), $gt: new Set(['number']), $lte: new Set(['number']), $gte: new Set(['number'])
      }
    },
    boolean: {
      type: ts.TypeFlags.Boolean,
      ops: {
        $ne: new Set(['boolean']), $eq: new Set(['boolean']), $exists: new Set(['boolean']),
        $in: new Set(['boolean[]']), $nin: new Set(['boolean[]'])
      }
    },
    date: {
      type: 'Date',
      ops: {
        $ne: new Set(['Date']), $eq: new Set(['Date']), $exists: new Set(['boolean']),
        $in: new Set(['Date[]']), $nin: new Set(['Date[]']),
        $lt: new Set(['Date']), $gt: new Set(['Date']),
        $lte: new Set(['Date']), $gte: new Set(['Date'])
      }
    },
    geo: {
      type: 'GeoPoint',
      ops: {
        $ne: new Set(['GeoPoint']), $eq: new Set(['GeoPoint']), $exists: new Set(['boolean']),
        $in: new Set(['GeoPoint[]']), $nin: new Set(['GeoPoint[]']),
        $geoWithin: new Set('GeoPoint[]'), $geoIntersects: new Set(['GeoPoint[]'])
      }
    }
  }

  cache = new Map<any, Map<string, ts.Symbol>>();

  constructor(private ctx: Lint.WalkContext<void>, private tc: ts.TypeChecker) {
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
          this.ctx.addFailureAtNode(target, `Operator clause only supports types of ${ts.TypeFlags[primitiveType].toLowerCase()}, not ${this.tc.typeToString(type)}`);
        }
      } else {
        let primitiveString = this.tc.typeToString(type);
        if (primitiveType !== primitiveString) {
          this.ctx.addFailureAtNode(target, `Operator clause only supports types of ${primitiveType}, not ${primitiveString}`);
        }
      }
      return;
    }

    let members = this.getMembersByType(type);
    if (members.size !== 1) {
      this.ctx.addFailureAtNode(target, `One and only one operation may be specified in an operator clause`);
    }
    let [key, value] = members.entries().next().value;
    let passedType = (value as any).type as ts.Type;

    if (!(key in allowed)) {
      this.ctx.addFailureAtNode(target, `Operation ${key}, not allowed for field of type ${this.tc.typeToString(passedType)}`);
    } else {
      let passedTypeName = this.tc.typeToString(passedType);
      if (!allowed[key].has(passedTypeName)) {
        this.ctx.addFailureAtNode(target, `Passed in value ${passedTypeName} mismatches with expected type(s) ${Array.from(allowed[key])}`);
      }
    }
  }

  processGenericClause(node: ts.Node, model: ts.Type, passed: ts.Type, handler: ProcessingHandler) {
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
        this.ctx.addFailureAtNode(node, `Unknown member ${state.passedMemberKey}`);
        continue;
      }

      let op: string | undefined;

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
    }
  }

  processWhereClause(node: ts.Node, model: ts.Type, passed: ts.Type) {
    return this.processGenericClause(node, model, passed, {
      preMember: (state: ProcessingState) => {
        if (state.passedMemberKey.charAt(0) === '$') {
          if (state.passedMembers.size > 1) {
            this.ctx.addFailureAtNode(state.passedMemberTypeNode, `You can only have one $and, $or, or $not in a single object`);
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
              this.ctx.addFailureAtNode(n, `${state.passedMemberKey} requires the value to be an array`);
            }
          } else if (state.passedMemberKey === '$not') {
            // Not loop
            if (this.checkIfObjectType(n)) {
              if (ts.isTypeReferenceNode(n)) {
                // bail on deep dive on variables
              }

              this.processWhereClause(node, model, state.passedMemberType);
            } else {
              this.ctx.addFailureAtNode(n, `${state.passedMemberKey} requires the value to be an object`);
            }
          } else {
            this.ctx.addFailureAtNode(state.passedMemberTypeNode, `Unknown high level operator ${state.passedMemberKey}`);
            // Error
          }
          return true;
        }
      },

      onSimpleType: (state: ProcessingState, type: string) => {
        let conf = QueryHandler.OPERATORS[type];
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
    return true;
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
        this.ctx.addFailureAtNode(state.passedMemberTypeNode, `Only true, false -1, and 1 are allowed for sorting, not ${this.getLiteralText(value)}`);
      }
    });
  }

  processSelectClause(node: ts.Node, model: ts.Type, member: ts.Type) {
    return this.processGenericClause(node, model, member, {
      onSimpleType: (state, type, value) => {
        if (this.hasFlags(state.passedMemberType.flags, ts.TypeFlags.Number, ts.TypeFlags.Boolean)) {
          console.log('Number node', this.isLiteral(value));

          if (this.isLiteral(value)) {
            if (['1', '0', 'true', 'false'].includes(this.getLiteralText(value))) {
              return;
            }
            this.ctx.addFailureAtNode(value, `Only true, false 0, and 1 are allowed for including/excluding fields`);
          } else {
            return;
          }
        } else if (this.hasFlags(state.passedMemberType.flags, ts.TypeFlags.String)) {
          if (this.isLiteral(value) && !/[A-Za-z_$0-9]/.test(this.getLiteralText(value))) {
            this.ctx.addFailureAtNode(value, `Only A-Z, a-z, 0-9, '$' and '_' are allowed in aliases for selecting fields`);
            return;
          }
          return;
        } else if (this.checkIfObjectType(state.passedMemberTypeNode) && !ts.isTypeReferenceNode(state.passedMemberTypeNode)) {
          let sub = state.passedMemberType;
          let subMembers = this.getMembersByType(sub);

          if (!subMembers.has('alias')) {
            this.ctx.addFailureAtNode(state.passedMemberTypeNode, `Alias is a required field for selecting`);
            return;
          } else {
            console.log('Yay');
          }
        }
        this.ctx.addFailureAtNode(state.passedMemberTypeNode, `Only true, false -1, and 1 or { alias: string, calc?: string } are allowed for selecting fields`);
      }
    });
  }

  processQuery(queryType: ts.Type, passedNode: ts.Node) {
    if (queryType && queryType.aliasSymbol) {
      let queryName = `${queryType.aliasSymbol.escapedName}`;

      if (QueryHandler.QUERY_TYPES[queryName] && queryType.aliasTypeArguments && queryType.aliasTypeArguments.length) {
        let modelType = queryType.aliasTypeArguments[0];

        let members = this.getMembersByType(queryType)

        if (members && members.size) {
          let passedType = this.tc.getTypeAtLocation(passedNode);
          let passedMembers = this.getMembersByType(passedType);
          for (let k of ['select', 'where', 'groupBy', 'sort']) {
            if (members.has(k) && passedMembers.has(k)) {
              (this as any)[`process${k.charAt(0).toUpperCase()}${k.substring(1)}Clause`](passedNode, modelType, (passedMembers.get(k)! as any).type);
            }
          }
        }
      }
    }
  }
}