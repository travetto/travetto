import ts from 'typescript';

import { TransformerState, AfterFile } from '@travetto/transformer';

const HELPER_MOD = '@travetto/manifest/src/path';

/**
 *  Supporting `__output` as a file property
 */
export class FileSourceTransformer {

  @AfterFile()
  static registerFileSource(state: TransformerState, node: ts.SourceFile): typeof node {
    if (state.importName === HELPER_MOD) {
      return node;
    }

    const { ident } = state.importFile(HELPER_MOD, 'ᚕ_p');

    const toAdd = [
      state.factory.createVariableStatement(
        [],
        state.factory.createVariableDeclarationList(
          [
            state.factory.createVariableDeclaration(
              '__output',
              undefined,
              undefined,
              state.factory.createCallExpression(
                state.createAccess(ident, 'path', 'forSrc'),
                [],
                [state.getFilenameIdentifier()]
              )
            )
          ],
          ts.NodeFlags.Const
        )
      )
    ];

    state.addStatements(toAdd, 0);

    return node;
  }
}