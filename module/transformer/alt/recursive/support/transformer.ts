import * as util from 'util';
import * as ts from 'typescript';

import { TransformerState, OnMethod } from '../../..';

export class MakeUpper {

  @OnMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration) {
    const resolved = state.resolveReturnType(node);

    delete resolved.original;

    const msg = util.inspect(resolved);

    return ts.updateMethod(
      node,
      [],
      node.modifiers,
      undefined,
      node.name,
      undefined,
      node.typeParameters,
      node.parameters,
      node.type,
      ts.createBlock(ts.createNodeArray([
        ts.createExpressionStatement(ts.createLiteral(msg)),
      ]))
    );
  }
}