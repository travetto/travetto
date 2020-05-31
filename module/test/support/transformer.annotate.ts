import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, DecoratorMeta, OnMethod, OnClass
} from '@travetto/compiler/src/transform-support';

/**
 * Annotate tests and suites for better diagnostics
 */
export class AnnotationTransformer {

  @OnClass('trv/test/Suite')
  @OnMethod('trv/test/Test')
  static annotate(state: TransformerState, node: ts.MethodDeclaration | ts.ClassDeclaration, dm?: DecoratorMeta) {

    const dec = dm?.dec;

    // If we have a @Suite/@Test decorator
    if (dec && ts.isCallExpression(dec.expression)) {
      const args = [...(dec.expression.arguments ?? [])];
      const n = (TransformUtil.hasOriginal(node) ? node.original : node) as ts.MethodDeclaration;

      // Add line start/end information into the decorator
      dec.expression.arguments = ts.createNodeArray([...args, TransformUtil.fromLiteral({
        lines: {
          ...TransformUtil.getRangeOf(state.source, n),
          codeStart: TransformUtil.getRangeOf(state.source, n?.body?.statements[0])?.start
        }
      })]);
    }
    return node;
  }
}