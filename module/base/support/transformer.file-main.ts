import ts from 'typescript';

import { AfterFile, TransformerState } from '@travetto/transformer';

const MAIN_MOD = '@travetto/base/support/init.main';

/**
 *  Auto importing setup for main entry points
 */
export class FileMainTransformer {

  @AfterFile()
  static registerMainMethod(state: TransformerState, node: ts.SourceFile): typeof node {
    const toStmt = (x: ts.Expression): ts.Statement => state.factory.createExpressionStatement(x);

    // If not a main file
    if (!/[/]main[.]/.test(state.importName)) {
      return node;
    }

    const mainFn = node.statements
      .filter((x): x is ts.FunctionDeclaration => x && ts.isFunctionDeclaration(x))
      .find(x => x.name?.getText() === 'main');


    // If we cannot find a main function
    if (!mainFn) {
      return node;
    }

    const { ident } = state.importFile(MAIN_MOD);

    state.addStatements([
      toStmt(
        state.factory.createCallExpression(state.createAccess(ident, 'runIfMain'), [], [
          mainFn.name!,
          state.getFilenameIdentifier(),
          state.getEntryFileIdentifier()
        ])
      )
    ]);

    return node;
  }
}