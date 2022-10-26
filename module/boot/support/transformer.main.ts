import * as ts from 'typescript';

import { TransformerId, AfterFile, TransformerState } from '@travetto/transformer';

/**
 *  Auto importing setup for main entry points
 */
export class FileMainTransformer {

  static [TransformerId] = '@trv:boot';

  @AfterFile()
  static afterFile(state: TransformerState, node: ts.SourceFile): typeof node {
    const before: ts.Statement[] = [];
    const after: ts.Statement[] = [];
    const toStmt = (x: ts.Expression): ts.Statement => state.factory.createExpressionStatement(x);

    // If not a main file
    if (!/[/]main[.]/.test(state.module)) {
      return node;
    }

    const mainFn = node.statements
      .filter((x): x is ts.FunctionDeclaration => x && ts.isFunctionDeclaration(x))
      .find(x => x.name?.getText() === 'main');


    // If we cannot find a main function
    if (!mainFn) {
      return node;
    }

    state.addStatements(
      [
        state.factory.createImportDeclaration(
          [],
          undefined,
          state.factory.createStringLiteral('@travetto/boot/support/init')
        )
      ], 0
    );

    state.addStatements([
      toStmt(
        state.factory.createBinaryExpression(
          state.factory.createBinaryExpression(
            state.createAccess('require', 'main'),
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            state.createIdentifier('module')
          ),
          ts.SyntaxKind.AmpersandAmpersandToken,
          state.factory.createCallExpression(state.createAccess('ᚕtrv', 'main'), [], [mainFn.name!])
        )
      )
    ]);

    return node;
  }
}