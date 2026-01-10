import ts from 'typescript';

import { type TransformerState, RegisterHandler } from '@travetto/transformer';

const PATH_IMPORT = '@travetto/manifest/src/path.ts';

const isImport = (node: ts.Node): node is ts.ImportDeclaration =>
  ts.isImportDeclaration(node)
  && ts.isStringLiteral(node.moduleSpecifier)
  && (
    node.moduleSpecifier.text === 'node:path'
    || node.moduleSpecifier.text === 'path'
  );

/**
 * Rewriting path imports to use manifest's path
 */
export class PathImportTransformer {

  static {
    RegisterHandler(this, this.rewritePathImport, 'before', 'file');
  }

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