import * as ts from 'typescript';

import { TransformerId, AfterFile, TransformerState, LiteralUtil } from '@travetto/transformer';

/**
 *  General file cleanup, including:
 *   - Removing typescript imports
 *   - Adding necessary info for cyclical dependency checks
 *   - Auto importing setup for main entry points
 */
export class FileTransformer {

  static [TransformerId] = '@trv:boot';

  @AfterFile()
  static afterFile(state: TransformerState, node: ts.SourceFile): typeof node {
    const before: ts.Statement[] = [];
    const after: ts.Statement[] = [];
    const toStmt = (x: ts.Expression): ts.Statement => state.factory.createExpressionStatement(x);

    for (let i = 0; i < node.statements.length; i++) {
      const el = node.statements[i];
      if (
        ts.isImportDeclaration(el) &&
        LiteralUtil.toLiteral(el.moduleSpecifier) === 'typescript'
      ) {
        const imp = el.importClause;
        if (imp) {
          const name = imp.namedBindings;
          if (name && ts.isNamespaceImport(name) && name.name.getText() === 'ts') {
            // @ts-expect-error
            node.statements[i] = undefined;
          }
        }
      }
    }

    if (/support[\\\/]main[.]/.test(node.fileName)) {
      before.push(
        state.factory.createImportDeclaration(
          [],
          undefined,
          state.factory.createStringLiteral('@travetto/boot/src/internal/setup')
        )
      );

      after.push(toStmt(
        state.factory.createCallExpression(state.createIdentifier('main'), [], [])
      ));
    }

    after.push(toStmt(
      state.factory.createCallExpression(
        state.createAccess('Object', 'defineProperty'),
        [],
        [
          state.createIdentifier('exports'),
          state.fromLiteral('ᚕtrv'),
          state.fromLiteral({ configurable: true, value: true })
        ]
      )
    ));

    if (before.length) {
      state.addStatements(before, 0);
    }
    if (after.length) {
      state.addStatements(after);
    }

    return node;
  }
}