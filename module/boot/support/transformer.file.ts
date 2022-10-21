import * as ts from 'typescript';

import { TransformerId, AfterFile, TransformerState, OnFile } from '@travetto/transformer';

/**
 *  General file cleanup, including:
 *   - Removing typescript imports
 *   - Adding necessary info for cyclical dependency checks
 *   - Auto importing setup for main entry points
 */
export class FileTransformer {

  static [TransformerId] = '@trv:boot';

  @OnFile()
  static onFile(state: TransformerState, node: ts.SourceFile): typeof node {
    const toAdd = state.factory.createVariableStatement(
      [],
      state.factory.createVariableDeclarationList([
        state.factory.createVariableDeclaration(
          '__source',
          undefined,
          undefined,
          state.factory.createCallExpression(
            state.createIdentifier('ᚕsrc'), [], [state.createIdentifier('__filename')]
          )
        )
      ])
    );
    let start = node.statements.findIndex(x => ts.isImportDeclaration(x));
    while (start < node.statements.length - 1 && ts.isImportDeclaration(node.statements[start + 1])) {
      start += 1;
    }

    // Declare __source
    return state.factory.updateSourceFile(
      node,
      start > 0 ? [
        ...node.statements.slice(0, start),
        toAdd,
        ...node.statements.slice(start)
      ] : [
        toAdd,
        ...node.statements
      ]
    );
  }

  @AfterFile()
  static afterFile(state: TransformerState, node: ts.SourceFile): typeof node {
    const before: ts.Statement[] = [];
    const after: ts.Statement[] = [];
    const toStmt = (x: ts.Expression): ts.Statement => state.factory.createExpressionStatement(x);

    // Create main entry point
    if (/[/]main[.]/.test(state.module)) {
      const mainFn = node.statements
        .filter((x): x is ts.FunctionDeclaration => x && ts.isFunctionDeclaration(x))
        .find(x => x.name?.getText() === 'main');

      if (mainFn) {
        before.push(
          state.factory.createImportDeclaration(
            [],
            undefined,
            state.factory.createStringLiteral('@travetto/boot/support/init')
          )
        );

        after.push(toStmt(
          state.factory.createBinaryExpression(
            state.factory.createBinaryExpression(
              state.createAccess('require', 'main'),
              ts.SyntaxKind.EqualsEqualsEqualsToken,
              state.createIdentifier('module')
            ),
            ts.SyntaxKind.AmpersandAmpersandToken,
            state.factory.createCallExpression(state.createIdentifier('ᚕmain'), [], [mainFn.name!])
          )));
      }
    }

    // Tag for cycle detection
    after.push(toStmt(
      state.factory.createCallExpression(
        state.createAccess('Object', 'defineProperty'),
        [],
        [
          state.createIdentifier('exports'),
          state.fromLiteral('ᚕtrv'),
          state.fromLiteral({ configurable: true, value: true })
        ]
      )
    ));

    if (before.length) {
      state.addStatements(before, 0);
    }
    if (after.length) {
      state.addStatements(after);
    }

    return node;
  }
}