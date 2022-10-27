import * as ts from 'typescript';

import { TransformerId, TransformerState, OnCall } from '@travetto/transformer';

/**
 * Allows for removal of debug log messages depending on whether app is running
 * in prod mode.
 */
export class PosixTransformer {

  static [TransformerId] = '@trv:boot';

  @OnCall()
  static onCall(state: TransformerState, node: ts.CallExpression): typeof node {
    if (!ts.isPropertyAccessExpression(node.expression)) {
      return node;
    }

    const chain = node.expression;
    const name = chain.name;
    const prop = chain.expression;

    if (!ts.isIdentifier(name) || name.text !== 'toPosix') {
      return node;
    }

    return state.factory.updateCallExpression(
      node,
      state.createAccess('ᚕtrv', 'posix'),
      node.typeArguments, [prop]
    );
  }
}