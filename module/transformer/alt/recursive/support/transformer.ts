import * as ts from 'typescript';

import { TransformerState, OnMethod } from '../../..';

export class MakeUpper {

  @OnMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration) {
    const resolved = state.resolveReturnType(node);

    const msg = JSON.stringify(resolved, (k, v) => {
      if (v) {
        if (v.target) {
          v.target = v.target.name;
        }
        return v;
      }
    }, 2).replace(/["]/g, '');

    console.log(msg);

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
      ts.updateBlock(node.body!, ts.createNodeArray([
        ts.createExpressionStatement(ts.createLiteral(msg)),
        ...node.body?.statements ?? []
      ]))
    );
  }
}