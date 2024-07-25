import ts from 'typescript';

import { TransformerState, OnFile } from '@travetto/transformer';

const PATH_REGEX = /^['"](node:)?path['"]$/;
const PATH_TARGET = '@travetto/manifest/src/path';
const SKIP_SRC = /^@travetto\/manifest\/(src|support)/;

/**
 * Rewriting path imports to use manifest's path
 */
export class PathImportTransformer {

  /**
   * Hash each class
   */
  @OnFile()
  static rewritePathImport(state: TransformerState, node: ts.SourceFile): ts.SourceFile {
    if (SKIP_SRC.test(state.importName)) {
      return node;
    }

    const stmt = node.statements.find((x): x is ts.ImportDeclaration =>
      ts.isImportDeclaration(x) && PATH_REGEX.test(x.moduleSpecifier?.getText() ?? ''));
    if (stmt) {
      const updated = state.factory.updateImportDeclaration(
        stmt,
        stmt.modifiers,
        stmt.importClause,
        state.factory.createStringLiteral(PATH_TARGET),
        stmt.attributes
      );
      return state.factory.updateSourceFile(node, node.statements.map(x =>
        x === stmt ? updated : x
      ));
    }
    return node;
  }
}