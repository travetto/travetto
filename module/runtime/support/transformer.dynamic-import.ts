import ts from 'typescript';

import { OnCall, TransformerState } from '@travetto/transformer';

/**
 * Dynamic Import Transformer
 */
export class DynamicImportTransformer {

  @OnCall()
  static onCall(state: TransformerState, node: ts.CallExpression): typeof node | ts.Identifier {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length &&
      ts.isLiteralExpression(node.arguments[0])
    ) {
      const lit = state.normalizeModuleSpecifier(node.arguments[0])!;
      if (lit !== node.arguments[0]) {
        return state.factory.updateCallExpression(node, node.expression, node.typeArguments, [lit, ...node.arguments.slice(1)]);
      }
    }
    return node;
  }
}