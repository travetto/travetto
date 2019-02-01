import { TransformUtil } from '@travetto/compiler';
import { FsUtil } from '@travetto/base/src/fs-util';

const TEST_IMPORT = '@travetto/test';

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: any): T {

  if (ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) {
    const dec = TransformUtil.findAnyDecorator(state, node, {
      Test: new Set([TEST_IMPORT]),
      Suite: new Set([TEST_IMPORT])
    });

    if (dec && ts.isCallExpression(dec.expression)) {
      const args = [...(dec.expression.arguments || [])];
      const n = ((node as any)['original'] || node) as ts.Node;
      const src = ts.createSourceFile(state.source.fileName, state.source.text, state.source.languageVersion);
      const start = ts.getLineAndCharacterOfPosition(src, n.getStart());
      const end = ts.getLineAndCharacterOfPosition(src, n.getEnd());

      dec.expression.arguments = ts.createNodeArray([...args, TransformUtil.fromLiteral({
        lines: TransformUtil.fromLiteral({ start: start.line + 1, end: end.line + 1 })
      })]);
    }
  }

  const out = ts.visitEachChild(node, c => visitNode(context, c, state), context);
  out.parent = node.parent;

  if (ts.isClassDeclaration(out)) {
    for (const el of out.members) {
      if (!el.parent) {
        el.parent = out;
      }
    }
  }

  return out;
}

const TRANSFORMER = TransformUtil.importingVisitor<any>((source) => ({ source }), visitNode);

export const TestLineNumberTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    const name = FsUtil.toUnix(source.fileName);

    // Only apply to test files
    if (/\/test\//.test(name) && !/\/(src|node_modules)\//.test(name)) {
      // Annotate
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  phase: 'before',
  key: 'test:line-numbers',
  before: 'registry'
};