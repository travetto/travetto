import * as ts from 'typescript';
import * as path from 'path';
import { TransformUtil, Import, State } from '@travetto/compiler';
import { Transform } from 'stream';
import { LogLevels } from '../types';
import { AppEnv } from '@travetto/base';

const VALID_METHODS = new Set(['log', ...Object.keys(LogLevels)]);
const VALID_PROD_METHODS = new Set(['log', 'info', 'warn', 'error', 'fatal']);

interface IState extends State {
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

    if (AppEnv.prod && !VALID_PROD_METHODS.has(level)) {
      return ts.createEmptyStatement() as any as T; // Lose the logging if in prod
    }

    if (!state.imported) {
      state.imported = ts.createIdentifier(`import_Logger`);
      state.newImports.push({
        ident: state.imported,
        path: require.resolve('../service/logger')
      });
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

      payload = TransformUtil.extendObjectLiteral({ args }, payload)
    }

    return ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(state.imported, 'Logger'), 'log'), undefined,
      ts.createNodeArray([payload])
    ) as any as T;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

export const LoggerTransformer = {
  transformer: TransformUtil.importingVisitor<IState>((file: ts.SourceFile) => {
    return { source: file };
  }, visitNode),
  phase: 'before',
  priority: 1
}