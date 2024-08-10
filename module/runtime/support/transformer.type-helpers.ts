import ts from 'typescript';

import { TransformerState, OnCall } from '@travetto/transformer';

const SRC = '@travetto/runtime/src/types.ts';

/**
 * Allows for removal of type helpers at compile time
 */
export class TypeHelpersTransformer {
  @OnCall()
  static onTypeHelper(state: TransformerState, node: ts.CallExpression): ts.Node {
    if (
      ts.isIdentifier(node.expression) &&
      node.arguments.length === 1 &&
      /impartial|cast/i.test(node.expression.escapedText.toString())
    ) {
      const type = state.resolveType(node.expression);
      if (type.key === 'unknown' && 'importName' in type && type.importName === SRC) {
        return node.arguments[0];
      }
    }
    return node;
  }
}