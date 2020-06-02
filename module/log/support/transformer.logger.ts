import * as ts from 'typescript';

import { EnvUtil } from '@travetto/boot';
import { ConsoleManager } from '@travetto/base';
import { TransformerState, OnCall, TransformUtil } from '@travetto/transformer';

/**
 * Allows for removal of debug log messages depending on whether app is running
 * in prod mode.
 */
export class LoggerTransformer {

  @OnCall()
  static handleCall(state: TransformerState, node: ts.CallExpression) {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== ConsoleManager.key) {
      return node;
    }
    const arg = TransformUtil.getPrimaryArgument(node);
    if (arg) {
      // Oay since we create the object ourselves
      const { level } = TransformUtil.toLiteral(arg, false);
      if (EnvUtil.isProd() && level === 'debug') {
        return ts.createIdentifier('undefined'); // Lose the logging if in prod
      }
    }
    return node;
  }
}