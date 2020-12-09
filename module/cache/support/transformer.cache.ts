import * as ts from 'typescript';

import { TransformerState, DecoratorMeta, OnMethod } from '@travetto/transformer';

const CACHE_UTIL = 'CacheUtil';

interface CacheState {
  util: ts.Identifier;
}

/**
 * Transform the cache headers
 */
export class CacheTransformer {

  static key = '@trv:cache';

  /**
   * Manage state for access to cache functions
   */
  static initState(state: TransformerState & CacheState) {
    if (!state.util) {
      const util = state.importFile(require.resolve('../src/util')).ident;
      state.util = util;
    }
  }

  /**
   * When `@Cache` and `@Evict` are present
   */
  @OnMethod('Cache', 'Evict')
  static instrumentCache(state: TransformerState & CacheState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {

    const isCache = !!state.findDecorator(this, node, 'Cache');
    const dec = dm?.dec;

    // If valid function
    if (dec && ts.isCallExpression(dec.expression)) {
      this.initState(state);

      const params = dec.expression.arguments;
      const id = params[0] as ts.Identifier;
      let config = params.length > 1 ? params[1] : state.fromLiteral({});

      // Read literal, and extend config onto it
      const parent = ((node.parent as ts.ClassExpression) || { name: { getText: () => 'unknown' } }).name!;
      const keySpace = `${parent.getText()}.${node.name.getText()}`;
      config = state.extendObjectLiteral({ keySpace }, config);

      // Create an arrow function to retain the `this` value.
      const fn = state.factory.createArrowFunction(
        [state.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
        undefined,
        [],
        undefined,
        undefined,
        node.body!
      );

      const target = state.factory.createElementAccessExpression(state.factory.createThis(), id);

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
              state.factory.createPropertyAccessExpression(target, isCache ? 'cache' : 'evict'),
              undefined,
              [
                config,
                state.factory.createThis(),
                fn,
                state.factory.createArrayLiteralExpression([
                  state.factory.createSpreadElement(state.createIdentifier('arguments'))
                ])
              ] as (readonly ts.Expression[]))
          )
        ])
      );
    }
    return node;
  }
}