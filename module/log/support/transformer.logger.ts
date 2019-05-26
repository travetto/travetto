import * as ts from 'typescript';

import { Env } from '@travetto/base';
import { RegisterUtil } from '@travetto/boot';
import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

import { LogLevels } from '../src/types';

const VALID_METHODS = new Set(['log', ...Object.keys(LogLevels)]);
const VALID_PROD_METHODS = new Set(['info', 'warn', 'error', 'fatal']);

const imported = Symbol('imported');
const isLoggable = Symbol('isLoggable');

interface LoggerState {
  [imported]?: ts.Identifier;
  [isLoggable]?: boolean;
}

export class LoggerTransformer {

  static handleCall(state: TransformerState & LoggerState, node: ts.CallExpression) {
    if (state[isLoggable] === undefined) {
      const name = state.source.fileName;
      state[isLoggable] = /travetto\/(module\/)?test\/src\//.test(name) || !name.includes('/test/') || name.includes('module/log/test');
    }

    if (!(
      state[isLoggable] &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'console' &&
      VALID_METHODS.has(node.expression.name.text)
    )) {
      return node;
    }

    const level = node.expression.name.text;

    if (Env.prod && !VALID_PROD_METHODS.has(level)) {
      return ts.createEmptyStatement(); // Lose the logging if in prod
    }

    if (!state[imported]) {
      state[imported] = state.importFile(require.resolve('../src/service')).ident;
    }

    const loc = ts.getLineAndCharacterOfPosition(state.source, node.expression.name.pos);

    let payload = TransformUtil.fromLiteral({
      file: state.source.fileName,
      line: loc.line + 1,
      level,
      category: RegisterUtil.computeModuleFromFile(state.source.fileName!)
    });

    const args = node.arguments.slice(0);

    // Drop the inserted category message by bootstrap, if present
    if (args.length && ts.isStringLiteral(args[0]) && args[0].getFullText().includes('[@trv:')) {
      args.shift();
    }

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
    return ts.createCall(ts.createPropertyAccess(ts.createPropertyAccess(state[imported]!, 'Logger'), 'log'), undefined, argv);
  }
}

export const transformers: NodeTransformer[] = [
  { type: 'call', all: true, before: LoggerTransformer.handleCall }
];