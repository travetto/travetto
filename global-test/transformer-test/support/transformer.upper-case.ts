import ts from 'typescript';

import { TransformerState, AfterMethod } from '@travetto/transformer';

export class MakeUpper {

  @AfterMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration): typeof node {
    if (!/@travetto-test[/]transformer[/]src[/]tree\d*.ts/.test(state.importName)) { // Only apply to my source code
      return node;
    }
    return state.factory.updateMethodDeclaration(
      node,
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      node.parameters,
      node.type,
      state.factory.createBlock([
        state.factory.createReturnStatement(
          state.fromLiteral(node.name.getText().toUpperCase())
        )
      ])
    );
  }
}