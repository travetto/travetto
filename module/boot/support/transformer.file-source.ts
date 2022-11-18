import * as ts from 'typescript';

import { TransformerId, TransformerState, AfterFile } from '@travetto/transformer';

const MANIFEST_MOD = '@travetto/manifest';
const HELPER_MOD = '@travetto/boot/support/init.helper';

/**
 *  Supporting `__output` as a file property
 */
export class FileSourceTransformer {

  static [TransformerId] = '@trv:boot';

  @AfterFile()
  static registerFileSource(state: TransformerState, node: ts.SourceFile): typeof node {
    if (state.module.startsWith(HELPER_MOD) || state.module.startsWith(MANIFEST_MOD)) {
      return node;
    }

    const { ident } = state.importFile(HELPER_MOD, 'ᚕ_');

    const toAdd = [
      state.factory.createVariableStatement(
        [],
        state.factory.createVariableDeclarationList([
          state.factory.createVariableDeclaration(
            '__output',
            undefined,
            undefined,
            state.factory.createCallExpression(
              state.createAccess(ident, 'trv', 'out'),
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