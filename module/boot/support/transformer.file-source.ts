import * as ts from 'typescript';

import { TransformerId, TransformerState, OnFile } from '@travetto/transformer';

/**
 *  Supporting `__source` as a file property
 */
export class FileSourceTransformer {

  static [TransformerId] = '@trv:boot';

  @OnFile()
  static onFile(state: TransformerState, node: ts.SourceFile): typeof node {
    if (state.module.includes('boot/support/init')) {
      return node;
    }
    const toAdd = state.factory.createVariableStatement(
      [],
      state.factory.createVariableDeclarationList([
        state.factory.createVariableDeclaration(
          '__source',
          undefined,
          undefined,
          state.factory.createCallExpression(
            state.createAccess('ᚕtrv', 'source'),
            [],
            [state.createIdentifier('__filename')]
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
}