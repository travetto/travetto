import * as ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnMethod, OnClass, CoreUtil, DecoratorUtil
} from '@travetto/transformer';

/**
 * Annotate tests and suites for better diagnostics
 */
export class AnnotationTransformer {

  static key = '@trv:test';

  /**
   * Build source annotation, indicating line ranges
   * @param state
   * @param node
   * @param dec
  */
  static buildAnnotation(state: TransformerState, node: ts.Node, dec: ts.Decorator & { expression: ts.CallExpression }) {
    const n = (CoreUtil.hasOriginal(node) ? node.original : node) as ts.MethodDeclaration;

    const newDec = state.factory.updateDecorator(
      dec,
      state.factory.createCallExpression(
        dec.expression.expression,
        dec.expression.typeArguments,
        [
          ...(dec.expression.arguments ?? []),
          state.fromLiteral({
            lines: {
              ...CoreUtil.getRangeOf(state.source, n),
              codeStart: CoreUtil.getRangeOf(state.source, n?.body?.statements[0])?.start
            }
          })
        ]
      )
    );
    return newDec;
  }

  @OnClass('Suite')
  static annotateSuiteDetails(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    const dec = dm?.dec;

    if (dec && ts.isCallExpression(dec.expression)) {
      const newDec = this.buildAnnotation(state, node, dec as ts.Decorator & { expression: ts.CallExpression });
      return state.factory.updateClassDeclaration(node,
        DecoratorUtil.spliceDecorators(node, dec, [newDec]),
        node.modifiers,
        node.name,
        node.typeParameters,
        node.heritageClauses,
        node.members
      );
    }
    return node;
  }

  @OnMethod('Test')
  static annotateTestDetails(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {
    const dec = dm?.dec;

    if (dec && ts.isCallExpression(dec.expression)) {
      const newDec = this.buildAnnotation(state, node, dec as ts.Decorator & { expression: ts.CallExpression });
      return state.factory.updateMethodDeclaration(node,
        DecoratorUtil.spliceDecorators(node, dec, [newDec]),
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        node.type,
        node.body
      );
    }
    return node;
  }
}