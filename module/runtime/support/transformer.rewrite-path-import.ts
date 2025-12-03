import ts from 'typescript';

import { TransformerState, OnFile } from '@travetto/transformer';

const PATH_REGEX = /^['"](node:)?path['"]$/;
const PATH_IMPORT = '@travetto/manifest/src/path.ts';

const isImport = (node: ts.Node): node is ts.ImportDeclaration =>
  ts.isImportDeclaration(node) && PATH_REGEX.test(node.moduleSpecifier?.getText() ?? '');

/**
 * Rewriting path imports to use manifest's path
 */
export class PathImportTransformer {

  /**
   * Hash each class
   */
  @OnFile()
  static rewritePathImport(state: TransformerState, node: ts.SourceFile): ts.SourceFile {
    const statement = node.statements.find(isImport);
    if (statement) {
      const updated = state.factory.updateImportDeclaration(
        statement,
        statement.modifiers,
        statement.importClause,
        state.factory.createStringLiteral(PATH_IMPORT),
        statement.attributes
      );
      return state.factory.updateSourceFile(node, node.statements.map(item =>
        item === statement ? updated : item
      ));
    }
    return node;
  }
}