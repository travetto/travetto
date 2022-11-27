import ts from 'typescript';

import { TransformerId, TransformerState, OnMethod } from '@travetto/transformer';

export class MakeUpper {

  static [TransformerId] = '@trv:transformer-test';

  @OnMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration): typeof node {
    if (!state.module.startsWith('transformer-test/')) { // Only apply to my source code
      return node;
    }
    return state.factory.updateMethodDeclaration(
      node,
      node.modifiers,
      node.asteriskToken,
      state.createIdentifier(node.name.getText().toUpperCase()),
      node.questionToken,
      node.typeParameters,
      node.parameters,
      node.type,
      node.body
    );
  }
}