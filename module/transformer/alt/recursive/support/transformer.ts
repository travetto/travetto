import * as util from 'util';
import * as ts from 'typescript';

import { TransformerId, TransformerState, OnMethod } from '../../..';

export class MakeUpper {

  static [TransformerId] = '@trv:transformer-test';

  @OnMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration) {
    if (!state.source.fileName.includes('alt/')) {
      return node;
    }
    const resolved = state.resolveReturnType(node);

    delete resolved.original;

    const msg = util.inspect(resolved, false, 5);

    return state.factory.updateMethodDeclaration(
      node,
      [],
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      node.parameters,
      node.type,
      state.factory.createBlock([
        state.factory.createExpressionStatement(state.fromLiteral(msg)),
      ])
    );
  }
}