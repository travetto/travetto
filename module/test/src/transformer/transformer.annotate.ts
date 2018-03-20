import * as ts from 'typescript';
import * as assert from 'assert';
import { TransformUtil, State } from '@travetto/compiler';

function isDeepLiteral(node: ts.Expression) {
  return ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node);
}

const TEST_IMPORT = '@travetto/test';

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: any): T {
  if (ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) {
    let dec = TransformUtil.findAnyDecorator(node, {
      'Test': new Set([TEST_IMPORT]),
      'Suite': new Set([TEST_IMPORT])
    }, state);
    if (dec) {
      if (ts.isCallExpression(dec.expression)) {
        let args = [...(dec.expression.arguments || [])];
        if (args.length === 0) {
          args = [ts.createLiteral('')];
        }

        const n = (node as any)['original'] || node;
        const src = ts.createSourceFile(state.source.fileName, state.source.text, state.source.languageVersion);
        const start = ts.getLineAndCharacterOfPosition(src, n.getFullStart());
        const end = ts.getLineAndCharacterOfPosition(src, n.getEnd());

        dec.expression.arguments = ts.createNodeArray([...args, TransformUtil.fromLiteral({
          line: start.line,
          lineEnd: end.line
        })]);
      }
    }
  }

  if (ts.isClassDeclaration(node)) {
    for (let el of node.members) {
      if (!el.parent) {
        el.parent = node;
      }
    }
  }

  return node;
}

const TRANSFORMER = TransformUtil.importingVisitor<any>((source) => ({ source }), visitNode);

export const TestTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    // Only apply to test files
    if (process.env.ENV === 'test' && source.fileName.includes('/test/') && !source.fileName.includes('/src/')) {
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  phase: 'before',
  priority: -1000
}