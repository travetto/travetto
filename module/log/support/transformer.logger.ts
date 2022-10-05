import * as ts from 'typescript';

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

  static initState(state: CustomState): void {
    state.scope = state.scope ?? [];
  }

  @OnClass()
  static onClass(state: CustomState, node: ts.ClassDeclaration): typeof node {
    this.initState(state);
    state.scope.push({ type: 'class', name: node.name?.text ?? 'unknown' });
    return node;
  }

  @AfterClass()
  static afterClass(state: CustomState, node: ts.ClassDeclaration): typeof node {
    state.scope.pop();
    return node;
  }

  @OnMethod()
  static onMethod(state: CustomState, node: ts.MethodDeclaration): typeof node {
    this.initState(state);
    let name = 'unknown';
    if (ts.isIdentifier(node.name)) {
      name = node.name?.text ?? name;
    }
    state.scope.push({ type: 'method', name });
    return node;
  }

  @AfterMethod()
  static afterMethod(state: CustomState, node: ts.MethodDeclaration): typeof node {
    state.scope.pop();
    return node;
  }

  @OnFunction()
  static onFunction(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    this.initState(state);
    state.scope.push({ type: 'function', name: node.name?.text ?? 'unknown' });
    return node;
  }

  @AfterFunction()
  static afterFunction(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    state.scope.pop();
    return node;
  }

  @OnCall()
  static onDebugCall(state: CustomState, node: ts.CallExpression): typeof node | ts.Identifier {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== 'ᚕlog') {
      return node;
    }

    const arg = CoreUtil.getArgument(node);
    if (!arg || !ts.isStringLiteral(arg)) {
      return node;
    }

    const level = LiteralUtil.toLiteral(arg, false);
    return state.factory.updateCallExpression(node, node.expression, node.typeArguments, [
      state.factory.createStringLiteral(level),
      LiteralUtil.fromLiteral(state.factory, {
        file: state.getFilename(),
        line: state.source.getLineAndCharacterOfPosition(node.getStart(state.source)).line + 1,
        scope: state.scope?.map(x => x.name).join(':'),
      }),
      ...node.arguments.slice(2) // Drop log level, and previous context from boot support
    ]);
  }
}