import * as ts from 'typescript';

import { ConsoleManager, Env } from '@travetto/base';
import { TransformerState, OnCall, TransformUtil } from '@travetto/compiler/src/transform-support';

export class LoggerTransformer {

  @OnCall()
  static handleCall(state: TransformerState, node: ts.CallExpression) {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== ConsoleManager.key) {
      return node;
    }

    const { level } = TransformUtil.toLiteral(node.arguments[0]);

    if (Env.prod && (level === 'debug' || level === 'trace')) {
      return ts.createEmptyStatement(); // Lose the logging if in prod
    }

    return node;
  }
}