import * as ts from 'typescript';

import { TransformerId, TransformerState, AfterFile } from '@travetto/transformer';

const INIT_MOD = '@travetto/boot/support/init';

/**
 *  Supporting `__output` as a file property
 */
export class FileSourceTransformer {

  static [TransformerId] = '@trv:boot';

  @AfterFile()
  static registerFileSource(state: TransformerState, node: ts.SourceFile): typeof node {
    if (state.module === INIT_MOD) {
      return node;
    }

    const toAdd = [
      state.factory.createVariableStatement(
        [],
        state.factory.createVariableDeclarationList([
          state.factory.createVariableDeclaration(
            '__output',
            undefined,
            undefined,
            state.factory.createCallExpression(
              state.createIdentifier('ᚕtrvOut'),
              [],
              [state.createIdentifier('__filename')]
            )
          )
        ])
      )
    ];

    state.addStatements(toAdd, 0);

    return node;
  }
}