import * as ts from 'typescript';

import { EnvUtil } from '@travetto/boot/src/env';
import { ConsoleManager } from '@travetto/base';
import {
  TransformerId, TransformerState, OnCall, CoreUtil, LiteralUtil,
  OnClass, AfterClass, OnMethod, AfterMethod, AfterFunction, OnFunction
} from '@travetto/transformer';

type CustomState = TransformerState & {
  scope: { type: 'method' | 'class' | 'function', name: string }[];
};

/**
 * Allows for removal of debug log messages depending on whether app is running
 * in prod mode.
 */
export class LoggerTransformer {

  static [TransformerId] = '@trv:log';

  static initState(state: CustomState) {
    state.scope = state.scope ?? [];
  }

  @OnClass()
  static onClass(state: CustomState, node: ts.ClassDeclaration) {
    this.initState(state);
    state.scope.push({ type: 'class', name: node.name?.text ?? 'unknown' });
    return node;
  }

  @AfterClass()
  static afterClass(state: CustomState, node: ts.ClassDeclaration) {
    state.scope.pop();
    return node;
  }

  @OnMethod()
  static onMethod(state: CustomState, node: ts.MethodDeclaration) {
    this.initState(state);
    let name = 'unknown';
    if (ts.isIdentifier(node.name)) {
      name = node.name?.text ?? name;
    }
    state.scope.push({ type: 'method', name });
    return node;
  }

  @AfterMethod()
  static afterMethod(state: CustomState, node: ts.MethodDeclaration) {
    state.scope.pop();
    return node;
  }

  @OnFunction()
  static onFunction(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression) {
    this.initState(state);
    state.scope.push({ type: 'function', name: node.name?.text ?? 'unknown' });
    return node;
  }

  @AfterFunction()
  static afterFunction(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression) {
    state.scope.pop();
    return node;
  }

  @OnCall()
  static onDebugCall(state: CustomState, node: ts.CallExpression) {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== ConsoleManager.key) {
      return node;
    }
    const arg = CoreUtil.getArgument(node);
    if (arg) {
      // Okay since we create the object ourselves in ConsoleManager
      const level = LiteralUtil.toLiteral(arg, false);
      if (EnvUtil.isProd() && level === 'debug') {
        return state.createIdentifier('undefined'); // Lose debug logging if in prod
      } else {
        return state.factory.updateCallExpression(node, node.expression, node.typeArguments, [
          state.factory.createStringLiteral(level),
          LiteralUtil.fromLiteral(state.factory, {
            file: state.getFilenameAsSrc(),
            line: state.source.getLineAndCharacterOfPosition(node.getStart(state.source)).line + 1,
            scope: state.scope?.map(x => x.name).join(':'),
          }),
          ...node.arguments.slice(2) // Drop log level, and previous context from base/console support
        ]);
      }
    }
    return node;
  }
}