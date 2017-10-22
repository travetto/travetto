import * as ts from 'typescript';
import * as Lint from 'tslint';
import { QuerySourceVerifier } from '../service/query-source';

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
      return new QuerySourceVerifier({
        collect(node: ts.Node, message: string) {
          ctx.addFailureAtNode(node, message);
        }
      }, tc).visitNode(ctx.sourceFile);
    }, undefined, program.getTypeChecker());
  }
}