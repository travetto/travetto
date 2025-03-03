import ts from 'typescript';

import { TransformerState, DecoratorMeta, OnProperty, DecoratorUtil } from '@travetto/transformer';

const DECORATOR_MOD = '@travetto/context/src/decorator';

/**
 * AsyncContextField transformer
 */
export class AsyncContextFieldTransformer {

  /**
   * Handle AsyncContextField annotations for fields
   */
  @OnProperty('AsyncContextField')
  static registerProperty(state: TransformerState, node: ts.PropertyDeclaration, dm?: DecoratorMeta): typeof node {
    const decl = state.findDecorator(this, node, 'AsyncContextField', DECORATOR_MOD);

    return state.factory.updatePropertyDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(DECORATOR_MOD, 'AsyncContextField', state.fromLiteral({ target: state.getConcreteType(node) })),
      ], 0),
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }
}