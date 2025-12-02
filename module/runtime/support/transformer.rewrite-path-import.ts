import ts from 'typescript';

import { TransformerState, OnFile } from '@travetto/transformer';

const PATH_REGEX = /^['"](node:)?path['"]$/;
const PATH_IMPORT = '@travetto/manifest/src/path.ts';

/**
 * Rewriting path imports to use manifest's path
 */
export class PathImportTransformer {

  /**
   * Hash each class
   */
  @OnFile()
  static rewritePathImport(state: TransformerState, node: ts.SourceFile): ts.SourceFile {
    const statement = node.statements.find((x): x is ts.ImportDeclaration =>
      ts.isImportDeclaration(x) && PATH_REGEX.test(x.moduleSpecifier?.getText() ?? ''));
    if (statement) {
      const updated = state.factory.updateImportDeclaration(
        statement,
        statement.modifiers,
        statement.importClause,
        state.factory.createStringLiteral(PATH_IMPORT),
        statement.attributes
      );
      return state.factory.updateSourceFile(node, node.statements.map(x =>
        x === statement ? updated : x
      ));
    }
    return node;
  }
}