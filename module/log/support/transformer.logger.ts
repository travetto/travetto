import { Env } from '@travetto/base';
import { TransformUtil, TransformerState } from '@travetto/compiler';

import { LogLevels } from '../src/types';

const VALID_METHODS = new Set(['log', ...Object.keys(LogLevels)]);
const VALID_PROD_METHODS = new Set(['info', 'warn', 'error', 'fatal']);

interface IState extends TransformerState {
  source: ts.SourceFile;
  imported?: ts.Identifier;
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: IState): T {
  if (ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'console' &&
    VALID_METHODS.has(node.expression.name.text)
  ) {
    const level = node.expression.name.text;

    if (Env.prod && !VALID_PROD_METHODS.has(level)) {
      const empty = ts.createEmptyStatement() as any as T; // Lose the logging if in prod
      empty.parent = node.parent;
      return empty;
    }

    if (!state.imported) {
      state.imported = TransformUtil.importFile(state, require.resolve('../src/service/logger')).ident;
    }

    const loc = ts.getLineAndCharacterOfPosition(state.source, node.expression.name.pos);

    let payload = TransformUtil.fromLiteral({
      file: state.source.fileName,
      line: loc.line + 1,
      level
    });

    const args = node.arguments.slice(0);

    if (args.length) {
      const arg = args[0];
      if (ts.isStringLiteral(arg) || ts.isTemplateExpression(arg) || ts.isBinaryExpression(arg)) {
        payload = TransformUtil.extendObjectLiteral({
          message: args.shift()
        }, payload);
      }

      payload = TransformUtil.extendObjectLiteral({ args }, payload);
    }

    const argv = ts.createNodeArray([payload]);
    const out = ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(state.imported, 'Logger'), 'log'), undefined, argv) as any as T;
    out.parent = node.parent;
    return out;
  } else {
    const ret = ts.visitEachChild(node, c => visitNode(context, c, state), context);
    if (ts.isClassDeclaration(ret)) {
      for (const el of ret.members) {
        if (!el.parent) {
          el.parent = ret;
        }
      }
    }
    return ret;
  }
}

export const LoggerTransformer = {
  transformer: TransformUtil.importingVisitor<IState>((file: ts.SourceFile) => {
    return { source: file };
  }, (ctx, node, state) => {
    const name = node.getSourceFile().fileName.toString();
    // Only apply to test files
    // Don't treat test logging as standard log messages
    if (name.includes('travetto/test/src') || !name.includes('/test/') || name.includes('module/log/test')) {
      return visitNode(ctx, node, state);
    } else {
      return node;
    }
  }),
  phase: 'before',
  priority: 1
};