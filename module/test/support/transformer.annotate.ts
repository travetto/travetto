import * as ts from 'typescript';

import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

class AnnotationTransformer {

  static annotate<T extends ts.Node>(state: TransformerState, node: T, dec: ts.Decorator) {
    if (ts.isCallExpression(dec.expression)) {
      const args = [...(dec.expression.arguments || [])];
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

export const transformers: NodeTransformer[] = [
  { type: 'method', alias: 'trv/test/Test', before: AnnotationTransformer.annotate },
  { type: 'class', alias: 'trv/test/Suite', before: AnnotationTransformer.annotate }
];