import * as ts from 'typescript';
import * as Lint from 'tslint';

const QueryTypes = [
  'Query', 'ModelQuery', 'PageableModelQuery'
].reduce((acc, v) => { acc[v] = true; return acc; }, {} as { [key: string]: boolean });

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
    return this.applyWithFunction(sourceFile, walk, undefined, program.getTypeChecker());
  }
}

function walk(ctx: Lint.WalkContext<void>, tc: ts.TypeChecker) {
  return ts.forEachChild(ctx.sourceFile, function cb(node: ts.Node): void {
    // sHandle direct invocation
    if (ts.isPropertyDeclaration(node)) {
      processQuery(ctx, tc, tc.getTypeAtLocation(node));
    } else if (ts.isCallExpression(node)) {
      let sig = tc.getResolvedSignature(node);
      if (sig) {
        for (let n of sig.parameters) {
          processQuery(ctx, tc, (n as any).type);
        }
      }
    } else if (ts.isVariableDeclaration(node)) {
      processQuery(ctx, tc, tc.getTypeAtLocation(node));
    }
    return ts.forEachChild(node, cb);
  });
}

let cache: { [key: string]: { [key: string]: ts.Symbol } } = {};

function getMembersByType(tc: ts.TypeChecker, type: ts.Type) {
  let key = type.aliasSymbol!.escapedName.toString();
  if (!(key in cache)) {
    let members = tc.getPropertiesOfType(type).reduce((acc, v) => {
      acc[v.escapedName.toString()] = v; return acc;
    }, {} as { [key: string]: ts.Symbol });
    cache[key] = members;
  }
  return cache[key];
}

function processQuery(ctx: Lint.WalkContext<void>, tc: ts.TypeChecker, queryType: ts.Type) {
  if (queryType && queryType.aliasSymbol) {
    let queryName = `${queryType.aliasSymbol.escapedName}`;

    if (QueryTypes[queryName] && queryType.aliasTypeArguments && queryType.aliasTypeArguments.length) {
      let modelType = queryType.aliasTypeArguments[0];

      console.log(queryName, tc.typeToString(modelType));
      let members = getMembersByType(tc, queryType)

      if (members) {
        if ('selct' in members) {
          console.log('Has Select');
        }
        if ('where' in members) {
          console.log('Has Where');
        }
        if ('groupBy' in members) {
          console.log('Has GroupBy');
        }
        if ('sort' in members) {
          console.log('Has SortBy');
        }
      }
    }
  }
}
