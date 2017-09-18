import * as ts from 'typescript';
import { TransformUtil, State } from '@encore2/compiler';

interface AssertState extends State {

}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {
  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.getText() === 'assert') {

    }
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

const TRANSFORMER = TransformUtil.importingVisitor<AssertState>(() => ({}), visitNode)

export const AssertTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    // Only apply to test files
    if (process.env.ENV === 'test' && source.fileName.includes('/test/') && !source.fileName.includes('/src/')) {
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  phase: 'before'
}