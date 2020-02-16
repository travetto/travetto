import * as ts from 'typescript';

import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

const CACHE_UTIL = 'CacheUtil';

interface CacheState {
  util: ts.Identifier;
  cache: ts.PropertyAccessExpression;
  evict: ts.PropertyAccessExpression;
}

class CacheTransformer {

  static initState(state: TransformerState & CacheState) {
    if (!state.util) {
      const util = state.importFile(require.resolve('../src/util')).ident;
      state.util = util;
      state.cache = ts.createPropertyAccess(ts.createPropertyAccess(util, CACHE_UTIL), 'cache');
      state.evict = ts.createPropertyAccess(ts.createPropertyAccess(util, CACHE_UTIL), 'evict');
    }
  }

  static handleMethod(state: TransformerState & CacheState, node: ts.MethodDeclaration, dec?: ts.Decorator) {

    const decl = TransformUtil.getDecoratorList(node);

    const isCache = !!decl.find(x => x.name === 'Cache');

    if (dec && ts.isCallExpression(dec.expression)) {
      this.initState(state);

      const params = dec.expression.arguments;
      const id = params[0] as ts.Identifier;
      let config = params.length > 1 ? params[1] : TransformUtil.fromLiteral({});

      if (ts.isObjectLiteralExpression(config)) {
        const parent = ((node.parent as ts.ClassExpression) || { name: { getText: () => 'unknown' } }).name!;
        const keySpace = `${parent.getText()}.${node.name.getText()}`;
        config = TransformUtil.extendObjectLiteral(config, TransformUtil.fromLiteral({ keySpace }));
      }

      const fn = ts.createArrowFunction(
        [ts.createModifier(ts.SyntaxKind.AsyncKeyword)],
        undefined,
        [],
        undefined,
        undefined,
        node.body!
      );

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

export const transformers: NodeTransformer[] = [
  { type: 'method', before: CacheTransformer.handleMethod.bind(CacheTransformer), alias: ['trv/cache/Cache', 'trv/cache/Evict'] },
];