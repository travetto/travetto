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
      return new QueryHandler(ctx, tc).walk();
    }, undefined, program.getTypeChecker());
  }
}

class QueryHandler {

  static QUERY_TYPES = [
    'Query', 'ModelQuery', 'PageableModelQuery'
  ].reduce((acc, v) => { acc[v] = true; return acc; }, {} as { [key: string]: boolean });

  cache: { [key: string]: { [key: string]: ts.Symbol } } = {};

  constructor(private ctx: Lint.WalkContext<void>, private tc: ts.TypeChecker) {
    this.visitNode = this.visitNode.bind(this);
  }


  getMembersByType(type: ts.Type) {
    let key = type.aliasSymbol!.escapedName.toString();
    if (!(key in this.cache)) {
      let members = this.tc.getPropertiesOfType(type).reduce((acc, v) => {
        acc[v.escapedName.toString()] = v; return acc;
      }, {} as { [key: string]: ts.Symbol });
      this.cache[key] = members;
    }
    return this.cache[key];
  }

  walk() {
    this.visitNode(this.ctx.sourceFile);
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


  processSelectClause(model: ts.Type, member: ts.Symbol) {

  }

  processWhereClause(model: ts.Type, member: ts.Symbol) {

  }

  processGroupByClause(model: ts.Type, member: ts.Symbol) {

  }

  processSortClause(model: ts.Type, member: ts.Symbol) {

  }

  processQuery(queryType: ts.Type, passedNode: ts.Node) {
    if (queryType && queryType.aliasSymbol) {
      let queryName = `${queryType.aliasSymbol.escapedName}`;

      if (QueryHandler.QUERY_TYPES[queryName] && queryType.aliasTypeArguments && queryType.aliasTypeArguments.length) {
        let modelType = queryType.aliasTypeArguments[0];

        console.log(queryName, this.tc.typeToString(modelType));
        let members = this.getMembersByType(queryType)
        if (members) {
          let passedType = this.tc.getTypeAtLocation(passedNode);

          if ('select' in members) {
            this.processSelectClause(modelType, (passedType as any).members.get('select'))
          }
          if ('where' in members) {
            this.processWhereClause(modelType, (passedType as any).members.get('where'))
          }
          if ('groupBy' in members) {
            this.processGroupByClause(modelType, (passedType as any).members.get('groupBy'))
          }
          if ('sort' in members) {
            this.processSortClause(modelType, (passedType as any).members.get('sort'))
          }
        }
      }
    }
  }

}


