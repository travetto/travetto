import * as ts from 'typescript';

import { TransformerId, AfterFile, TransformerState } from '@travetto/transformer';

/**
 * Tagging all the modules we transform
 */
export class FileModuleTagTransformer {

  static [TransformerId] = '@trv:boot';

  @AfterFile()
  static afterFile(state: TransformerState, node: ts.SourceFile): typeof node {
    // Tag for cycle detection
    state.addStatements([
      state.factory.createVariableStatement(
        [
          ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
          ts.factory.createModifier(ts.SyntaxKind.ConstKeyword)
        ],
        state.factory.createVariableDeclarationList([
          state.factory.createVariableDeclaration(
            'Ⲑtrv', undefined, undefined, state.factory.createTrue()
          )
        ])
      )
    ]);

    return node;
  }
}