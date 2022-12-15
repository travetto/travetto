import * as ts from 'typescript';

import {
  TransformerId, TransformerState, OnCall, LiteralUtil,
  OnClass, AfterClass, OnMethod, AfterMethod, AfterFunction, OnFunction
} from '@travetto/transformer';

type CustomState = TransformerState & {
  scope: { type: 'method' | 'class' | 'function', name: string }[];
};

const VALID_LEVELS: Record<string, string> = {
  log: 'info',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  error: 'error'
};

const INIT_MOD = '@travetto/boot/support/init';

/**
 * Allows for removal of debug log messages depending on whether app is running
 * in prod mode.
 */
export class LoggerTransformer {

  static [TransformerId] = '@trv:boot';

  static initState(state: CustomState): void {
    state.scope = state.scope ?? [];
  }

  @OnClass()
  static startClassForLog(state: CustomState, node: ts.ClassDeclaration): typeof node {
    this.initState(state);
    state.scope.push({ type: 'class', name: node.name?.text ?? 'unknown' });
    return node;
  }

  @AfterClass()
  static leaveClassForLog(state: CustomState, node: ts.ClassDeclaration): typeof node {
    state.scope.pop();
    return node;
  }

  @OnMethod()
  static startMethodForLog(state: CustomState, node: ts.MethodDeclaration): typeof node {
    this.initState(state);
    let name = 'unknown';
    if (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name)) {
      name = node.name?.text ?? name;
    }
    state.scope.push({ type: 'method', name });
    return node;
  }

  @AfterMethod()
  static leaveMethodForLog(state: CustomState, node: ts.MethodDeclaration): typeof node {
    state.scope.pop();
    return node;
  }

  @OnFunction()
  static startFunctionForLog(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    this.initState(state);
    state.scope.push({ type: 'function', name: node.name?.text ?? 'unknown' });
    return node;
  }

  @AfterFunction()
  static leaveFunctionForLog(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    state.scope.pop();
    return node;
  }

  @OnCall()
  static onLogCall(state: CustomState, node: ts.CallExpression): typeof node | ts.Identifier {
    if (!ts.isPropertyAccessExpression(node.expression) || state.module === INIT_MOD) {
      return node;
    }

    const chain = node.expression;
    const name = chain.name;
    const prop = chain.expression;

    if (!ts.isIdentifier(prop) || prop.escapedText !== 'console' || !ts.isIdentifier(name)) {
      return node;
    }

    const level = name.escapedText!;

    if (VALID_LEVELS[level]) {
      return state.factory.updateCallExpression(
        node,
        state.createIdentifier('ᚕtrvLog'),
        node.typeArguments,
        [
          state.factory.createStringLiteral(VALID_LEVELS[level]),
          LiteralUtil.fromLiteral(state.factory, {
            file: state.createIdentifier('__output'),
            line: state.source.getLineAndCharacterOfPosition(node.getStart(state.source)).line + 1,
            scope: state.scope?.map(x => x.name).join(':'),
          }),
          ...node.arguments.slice(0)
        ]
      );
    } else {
      return node;
    }
  }
}