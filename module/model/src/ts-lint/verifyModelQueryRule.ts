import * as ts from 'typescript';
import * as Lint from 'tslint';

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


  processSelectClause(node: ts.Node, model: ts.Type, member: ts.Type) {
    console.log('Select', model, member);
  }

  processWhereClause(node: ts.Node, model: ts.Type, passed: ts.Type) {
    if (passed === null) {
      //for (let m of member) {
      //        this.processWhereClause(model, m);
      //      }
    } else {
      let passedMembers: Map<string, ts.Symbol> = this.getMembersByType(passed);
      let modelMembers: Map<string, ts.Symbol> = this.getMembersByType(model);

      console.log(modelMembers.keys(), passedMembers.keys())

      for (let [passedMemberKey, passedMemberSymbol] of passedMembers.entries()) {

        let passedMemberType = (passedMemberSymbol as any).type as ts.Type;
        //let passedMemberTypeNode = this.tc.getTypeFromTypeNode(passedMemberTypeNode);
        //passedMemberTypeNode = this.tc.typeToTypeNode(passedMemberType);

        if (passedMemberKey.charAt(0) === '$') {
          if (passedMembers.size > 1) {
            // Error
          }
          if (passedMemberKey === '$and' || passedMemberKey === '$or') {
            //For loop
            this.processWhereClause(node, model, passedMemberType);
          } else if (passedMemberKey === '$not') {
            // Not loop
            this.processWhereClause(node, model, passedMemberType);
          } else {
            // Error
          }
        } else {
          let modelMemberSymbol = modelMembers.get(passedMemberKey);
          if (!modelMemberSymbol) {
            this.ctx.addFailureAtNode(node, `Unknown member ${passedMemberKey}`);
          } else {
            let modelMemberTypeNode = (modelMemberSymbol.valueDeclaration! as any).type;
            let modelMemberType: ts.Type = this.tc.getTypeFromTypeNode(modelMemberTypeNode);
            let modelMemberKind: ts.SyntaxKind = modelMemberTypeNode.kind;



            if (modelMemberKind === ts.SyntaxKind.StringKeyword) {
              this.checkOperatorClause(node, passedMemberType, ts.TypeFlags.String, { $ne: 'string', $eq: 'string', $exists: 'string' });
            } else if (modelMemberKind === ts.SyntaxKind.NumberKeyword) {
              this.checkOperatorClause(node, passedMemberType, ts.TypeFlags.Number,
                { $ne: 'number', $eq: 'number', $exists: 'number', $lt: 'number', $gt: 'number', $lte: 'number', $gte: 'number' });
            } else if (modelMemberKind === ts.SyntaxKind.BooleanKeyword) {
              this.checkOperatorClause(node, passedMemberType, ts.TypeFlags.Boolean, { $ne: 'boolean', $eq: 'boolean', $exists: 'boolean' });
            } else if (modelMemberKind === ts.SyntaxKind.ArrayType) {

            } else if (modelMemberKind === ts.SyntaxKind.TypeReference) {
              this.processWhereClause(node, modelMemberType, passedMemberType);
            }
          }
        }
      }
    }
  }

  checkOperatorClause(node: ts.Node, type: ts.Type, primitiveType: ts.TypeFlags, allowed: { [key: string]: string }) {
    if ((type.flags & ts.TypeFlags.Object) === 0) {
      if ((type.flags & primitiveType) === 0) {
        this.ctx.addFailureAtNode(node, `Operator clause only supports types of ${ts.TypeFlags[primitiveType].toLowerCase()}, not ${this.tc.typeToString(type)}`);
      }
      return;
    }

    let members = this.getMembersByType(type);
    if (members.size !== 1) {
      this.ctx.addFailureAtNode(node, `One and only one operation may be specified in an operator clause`);
    }
    let [key, value] = members.entries().next().value;
    let passedType = (value as any).type as ts.Type;

    if (!(key in allowed)) {
      this.ctx.addFailureAtNode(node, `Operation ${key}, not allowed for field of type ${this.tc.typeToString(passedType)}`);
    } else {
      let passedTypeName = this.tc.typeToString(passedType);
      if (passedTypeName !== allowed[key]) {
        this.ctx.addFailureAtNode(node, `Passed in value ${passedTypeName} mismatches with expected type ${allowed[key]}`);
      }
    }
  }

  processGroupByClause(node: ts.Node, model: ts.Type, member: ts.Type) {

  }

  processSortClause(node: ts.Node, model: ts.Type, member: ts.Type) {

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