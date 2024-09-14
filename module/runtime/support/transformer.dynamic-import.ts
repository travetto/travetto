import ts from 'typescript';

import { LiteralUtil, OnCall, TransformerState } from '@travetto/transformer';

/**
 * Dynamic Import Transformer
 */
export class DynamicImportTransformer {

  static #rewriteModuleSpecifier(state: TransformerState, spec: ts.LiteralExpression | ts.Expression | undefined): ts.Expression | undefined {
    if (spec && ts.isStringLiteral(spec) && state.isUntypedImport(spec)) {
      return LiteralUtil.fromLiteral(state.factory, `${spec.text.replace(/['"]/g, '')}.js`);
    }
    return spec;
  }

  @OnCall()
  static onLogCall(state: TransformerState, node: ts.CallExpression): typeof node | ts.Identifier {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length &&
      ts.isLiteralExpression(node.arguments[0])
    ) {
      const lit = this.#rewriteModuleSpecifier(state, node.arguments[0])!;
      if (lit !== node.arguments[0]) {
        return state.factory.updateCallExpression(node, node.expression, node.typeArguments, [lit, ...node.arguments.slice(1)]);
      }
    }
    return node;
  }
}