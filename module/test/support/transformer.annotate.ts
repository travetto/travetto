import * as ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnMethod, OnClass, CoreUtil, DecoratorUtil, TransformerId
} from '@travetto/transformer';

/**
 * Annotate tests and suites for better diagnostics
 */
export class AnnotationTransformer {

  static [TransformerId] = '@trv:test';

  /**
   * Build source annotation, indicating line ranges
   * @param state
   * @param node
   * @param dec
  */
  static buildAnnotation(state: TransformerState, node: ts.Node, dec: ts.Decorator, expression: ts.CallExpression): ts.Decorator {
    const ogN = (CoreUtil.hasOriginal(node) ? node.original : node);
    const n = ts.isMethodDeclaration(ogN) ? ogN : undefined;

    const newDec = state.factory.updateDecorator(
      dec,
      state.factory.createCallExpression(
        expression.expression,
        expression.typeArguments,
        [
          ...(expression.arguments ?? []),
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
  static annotateSuiteDetails(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta): ts.ClassDeclaration {
    const dec = dm?.dec;

    if (dec && ts.isCallExpression(dec.expression)) {
      const newDec = this.buildAnnotation(state, node, dec, dec.expression);
      return state.factory.updateClassDeclaration(node,
        DecoratorUtil.spliceDecorators(node, dec, [newDec]),
        node.name,
        node.typeParameters,
        node.heritageClauses,
        node.members
      );
    }
    return node;
  }

  @OnMethod('Test')
  static annotateTestDetails(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta): ts.MethodDeclaration {
    const dec = dm?.dec;

    if (dec && ts.isCallExpression(dec.expression)) {
      const newDec = this.buildAnnotation(state, node, dec, dec.expression);
      return state.factory.updateMethodDeclaration(node,
        DecoratorUtil.spliceDecorators(node, dec, [newDec]),
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