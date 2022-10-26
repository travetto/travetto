import * as ts from 'typescript';

import { TransformerId, AfterFile, TransformerState } from '@travetto/transformer';

/**
 * Tagging all the modules we transform
 */
export class FileModuleTagTransformer {

  static [TransformerId] = '@trv:boot';

  @AfterFile()
  static afterFile(state: TransformerState, node: ts.SourceFile): typeof node {
    const toStmt = (x: ts.Expression): ts.Statement => state.factory.createExpressionStatement(x);

    // Tag for cycle detection
    state.addStatements([toStmt(
      state.factory.createCallExpression(
        state.createAccess('Object', 'defineProperty'),
        [],
        [
          state.createIdentifier('exports'),
          state.fromLiteral('@trv'),
          state.fromLiteral({ configurable: false, value: true })
        ]
      )
    )]);

    return node;
  }
}