import ts from 'typescript';

import { TransformerState, DecoratorMeta, DecoratorUtil, AfterClass } from '@travetto/transformer';
import { SchemaTransformUtil } from '@travetto/schema/support/transform-util';

/**
 * Converts classes with `@CliCommand` to `@Schema` and maps the main method
 */
export class CliCommandTransformer {

  /**
   * On presence of `@CliCommand`
   */
  @AfterClass('CliCommand')
  static registerAppMethod(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta): typeof node {
    const dec = dm?.dec;

    if (!dec || !ts.isCallExpression(dec.expression)) { // If not valid
      return node;
    }

    // Find runnable method
    const runMethod = node.members
      .find((x): x is ts.MethodDeclaration =>
        ts.isMethodDeclaration(x) && x.name!.getText() === 'main'
      );

    if (!runMethod) {
      return node;
    }

    const declArgs = [...dec.expression.arguments];

    // Name only, need a config object
    if (declArgs.length === 0) {
      declArgs.push(state.fromLiteral({}));
    }

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
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members
    );
  }
}