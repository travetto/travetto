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

      for (let [passedMemberKey, passedMemberSymbol] of passedMembers.entries()) {

        let passedMemberTypeNode = (passedMemberSymbol as any).type;
        let passedMemberType = this.tc.getTypeFromTypeNode(passedMemberTypeNode);

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
            console.log('hi', modelMemberKind);
            if (modelMemberKind === ts.SyntaxKind.StringKeyword) {
              console.log('string', '='.repeat(20), '\n', modelMemberTypeNode, '='.repeat(20), '\n', passedMemberTypeNode, '='.repeat(20), '\n')
            } else if (modelMemberKind === ts.SyntaxKind.NumberKeyword) {

            } else if (modelMemberKind === ts.SyntaxKind.BooleanKeyword) {
            } else if (modelMemberKind === ts.SyntaxKind.ArrayType) {

            } else if (modelMemberKind === ts.SyntaxKind.TypeReference) {
              this.processWhereClause(node, modelMemberType, passedMemberType);
            }
          }
        }
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