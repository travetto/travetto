import * as ts from 'typescript';

import { TransformerState, DecoratorMeta, OnMethod, LiteralUtil, CoreUtil } from '@travetto/transformer';

const CACHE_UTIL = 'CacheUtil';

interface CacheState {
  util: ts.Identifier;
  cache: ts.PropertyAccessExpression;
  evict: ts.PropertyAccessExpression;
}

const CACHE_KEY = '@trv:cache/Cache';
const EVICT_KEY = '@trv:cache/Evict';

/**
 * Transform the cache headers
 */
export class CacheTransformer {

  /**
   * Manage state for access to cache functions
   */
  static initState(state: TransformerState & CacheState) {
    if (!state.util) {
      const util = state.importFile(require.resolve('../src/util')).ident;
      state.util = util;
      state.cache = CoreUtil.createAccess(util, CACHE_UTIL, 'cache');
      state.evict = CoreUtil.createAccess(util, CACHE_UTIL, 'evict');
    }
  }

  /**
   * When `@Cache` and `@Evict` are present
   */
  @OnMethod([CACHE_KEY, EVICT_KEY])
  static handleMethod(state: TransformerState & CacheState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {

    const isCache = dm?.targets?.includes(CACHE_KEY);
    const dec = dm?.dec;

    // If valid function
    if (dec && ts.isCallExpression(dec.expression)) {
      this.initState(state);

      const params = dec.expression.arguments;
      const id = params[0] as ts.Identifier;
      let config = params.length > 1 ? params[1] : LiteralUtil.fromLiteral({});

      // Read literal, and extend config onto it
      const parent = ((node.parent as ts.ClassExpression) || { name: { getText: () => 'unknown' } }).name!;
      const keySpace = `${parent.getText()}.${node.name.getText()}`;
      config = LiteralUtil.extendObjectLiteral({ keySpace }, config);

      // Create an arrow function to retain the `this` value.
      const fn = ts.createArrowFunction(
        [ts.createModifier(ts.SyntaxKind.AsyncKeyword)],
        undefined,
        [],
        undefined,
        undefined,
        node.body!
      );

      // Return new method calling evict or cache depending on decorator.
      return ts.updateMethod(
        node,
        node.decorators,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        node.type,
        ts.createBlock([
          ts.createReturn(
            ts.createCall(isCache ? state.cache : state.evict, undefined, [
              config,
              ts.createElementAccess(ts.createThis(), id),
              ts.createThis(),
              fn,
              ts.createArrayLiteral([ts.createSpread(ts.createIdentifier('arguments'))])
            ] as (readonly ts.Expression[]))
          )
        ])
      );
    }
    return node;
  }
}