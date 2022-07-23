import * as ts from 'typescript';

import { TransformerState, DecoratorMeta, OnMethod, TransformerId } from '@travetto/transformer';

/**
 * Transform the cache headers
 */
export class CacheTransformer {

  static [TransformerId] = '@trv:cache';

  /**
   * When `@Cache` and `@Evict` are present
   */
  @OnMethod('Cache', 'Evict')
  static instrumentCache(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta): ts.MethodDeclaration {

    const isCache = !!state.findDecorator(this, node, 'Cache');
    const dec = dm?.dec;

    // If valid function
    if (dec && ts.isCallExpression(dec.expression)) {
      const params = dec.expression.arguments;
      const mainExpression = params[0];

      const op = isCache ? 'cache' : 'evict';

      // Create an arrow function to retain the `this` value.
      const fn = state.factory.createArrowFunction(
        [state.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
        undefined,
        [],
        undefined,
        undefined,
        node.body!
      );

      // Return new method calling evict or cache depending on decorator.
      return state.factory.updateMethodDeclaration(
        node,
        node.decorators,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        node.type,
        state.factory.createBlock([
          state.factory.createReturnStatement(
            state.factory.createCallExpression(
              state.factory.createPropertyAccessExpression(
                state.factory.createElementAccessExpression(state.factory.createThis(), mainExpression), op
              ),
              undefined,
              [
                state.factory.createThis(),
                state.factory.createStringLiteral(node.name.getText()),
                fn,
                state.factory.createArrayLiteralExpression([
                  state.factory.createSpreadElement(state.createIdentifier('arguments'))
                ])
              ]
            )
          )
        ])
      );
    }
    return node;
  }
}