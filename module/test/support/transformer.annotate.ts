import ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnMethod, OnClass, CoreUtil, DecoratorUtil
} from '@travetto/transformer';

const RUN_UTIL = 'RunnerUtil';

const RunUtilⲐ = Symbol.for('@travetto/test:runner');

/**
 * Annotate transformation state
 */
interface AnnotateState {
  [RunUtilⲐ]?: ts.Expression;
}

/**
 * Annotate tests and suites for better diagnostics
 */
export class AnnotationTransformer {


  /**
   * Initialize transformer state
   */
  static initState(state: TransformerState & AnnotateState): void {
    if (!state[RunUtilⲐ]) {
      const runUtil = state.importFile('@travetto/test/src/execute/util').ident;
      state[RunUtilⲐ] = CoreUtil.createAccess(state.factory, runUtil, RUN_UTIL, 'tryDebugger');
    }
  }

  /**
   * Build source annotation, indicating line ranges
   * @param state
   * @param node
   * @param dec
  */
  static buildAnnotation(state: TransformerState & AnnotateState, node: ts.Node, dec: ts.Decorator, expression: ts.CallExpression): ts.Decorator {
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
            ident: `@${DecoratorUtil.getDecoratorIdent(dec).text}()`,
            lineBodyStart: CoreUtil.getRangeOf(state.source, n?.body?.statements[0])?.lineStart
          })
        ]
      )
    );
    return newDec;
  }

  @OnClass('Suite')
  static annotateSuiteDetails(state: TransformerState & AnnotateState, node: ts.ClassDeclaration, dm?: DecoratorMeta): ts.ClassDeclaration {
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
  static annotateTestDetails(state: TransformerState & AnnotateState, node: ts.MethodDeclaration, dm?: DecoratorMeta): ts.MethodDeclaration {
    this.initState(state);

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
        node.body ? state.factory.updateBlock(node.body, [
          state.factory.createIfStatement(state[RunUtilⲐ]!,
            state.factory.createExpressionStatement(state.factory.createIdentifier('debugger'))),
          ...node.body.statements
        ]) : node.body
      );
    }
    return node;
  }
}