import * as ts from 'typescript';

import {
  TransformerState, DecoratorMeta, CoreUtil, DecoratorUtil, TransformerId, AfterClass
} from '@travetto/transformer';
import { SchemaTransformUtil } from '@travetto/schema/support/transform-util';

/**
 * Converts classes with `@Application` to auto register with the `ApplicationRegistry`
 */
export class ApplicationTransformer {

  static [TransformerId] = '@trv:app';

  /**
   * On presence of `@Application`
   */
  @AfterClass('Application')
  static registerAppMethod(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    const dec = dm?.dec;

    if (!dec || !ts.isCallExpression(dec.expression)) { // If not valid
      return node;
    }

    // Find runnable method
    const runMethod = node.members
      .find(x =>
        ts.isMethodDeclaration(x) && x.name!.getText() === 'run'
      ) as ts.MethodDeclaration;

    if (!runMethod) {
      return node;
    }

    const declArgs = [...dec.expression.arguments];

    // Name only, need a config object
    if (declArgs.length === 0) {
      declArgs.push(state.fromLiteral({}));
    }

    // Track start point
    declArgs[1] = state.extendObjectLiteral(declArgs[1], {
      start: CoreUtil.getRangeOf(state.source, node)?.start,
      codeStart: CoreUtil.getRangeOf(state.source, runMethod.body?.statements[0])?.start
    });

    // Compute new declaration
    const newDec = state.factory.createDecorator(
      state.factory.createCallExpression(
        dec.expression.expression,
        dec.expression.typeArguments,
        [...declArgs]
      )
    );

    const members = node.members.map(x => ts.isMethodDeclaration(x) && x === runMethod ?
      state.factory.updateMethodDeclaration(
        x,
        x.decorators,
        x.modifiers,
        x.asteriskToken,
        x.name,
        x.questionToken,
        x.typeParameters,
        x.parameters.map(y => SchemaTransformUtil.computeField(state, y)),
        x.type,
        x.body
      ) : x);

    return state.factory.updateClassDeclaration(node,
      DecoratorUtil.spliceDecorators(node, dec, [newDec]),
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members
    );
  }
}