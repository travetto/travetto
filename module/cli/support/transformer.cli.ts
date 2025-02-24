import ts from 'typescript';

import { TransformerState, DecoratorMeta, AfterClass } from '@travetto/transformer';

import { SchemaTransformUtil } from '@travetto/schema/support/transformer/util.ts';

/**
 * Converts classes with `@CliCommand` to `@Schema` and maps the main method
 */
export class CliCommandTransformer {

  /**
   * On presence of `@CliCommand`
   */
  @AfterClass('CliCommand')
  static registerMainMethod(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta): typeof node {
    const dec = dm?.dec;

    if (!dec || !ts.isCallExpression(dec.expression)) { // If not valid
      return node;
    }

    // Find runnable method
    const mainMethod = node.members
      .find((x): x is ts.MethodDeclaration =>
        ts.isMethodDeclaration(x) && x.name!.getText() === 'main'
      );

    if (!mainMethod) {
      return node;
    }

    const members = node.members.map(x => ts.isMethodDeclaration(x) && x === mainMethod ?
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
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members
    );
  }
}