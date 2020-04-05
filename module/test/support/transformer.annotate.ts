import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, DecoratorMeta, OnMethod, OnClass
} from '@travetto/compiler/src/transform-support';

export class AnnotationTransformer {

  @OnClass('trv/test/Suite')
  @OnMethod('trv/test/Test')
  static annotate(state: TransformerState, node: ts.MethodDeclaration | ts.ClassDeclaration, dm?: DecoratorMeta) {
    const dec = dm?.dec;
    if (dec && ts.isCallExpression(dec.expression)) {
      const args = [...(dec.expression.arguments ?? [])];
      const n = ((node as any)['original'] || node) as ts.Node;
      const start = ts.getLineAndCharacterOfPosition(state.source, n.getStart());
      const end = ts.getLineAndCharacterOfPosition(state.source, n.getEnd());

      dec.expression.arguments = ts.createNodeArray([...args, TransformUtil.fromLiteral({
        lines: TransformUtil.fromLiteral({ start: start.line + 1, end: end.line + 1 })
      })]);
    }
    return node;
  }
}