import ts from 'typescript';

import { type TransformerState, LiteralUtil, TransformerHandler } from '@travetto/transformer';

const CONSOLE_IMPORT = '@travetto/runtime/src/console.ts';

type CustomState = TransformerState & {
  scope: { type: 'method' | 'class' | 'function', name: string }[];
  imported?: ts.Identifier;
};

const VALID_LEVELS: Record<string, string> = {
  log: 'info',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  error: 'error'
};

/**
 * Logging support with code-location aware messages.
 */
export class ConsoleLogTransformer {

  static {
    TransformerHandler(this, this.startClassForLog, 'before', 'class');
    TransformerHandler(this, this.leaveClassForLog, 'after', 'class');
    TransformerHandler(this, this.startMethodForLog, 'before', 'method');
    TransformerHandler(this, this.startMethodForLog, 'before', 'static-method');
    TransformerHandler(this, this.leaveMethodForLog, 'after', 'method');
    TransformerHandler(this, this.leaveMethodForLog, 'after', 'static-method');
    TransformerHandler(this, this.startFunctionForLog, 'before', 'function');
    TransformerHandler(this, this.leaveFunctionForLog, 'after', 'function');
    TransformerHandler(this, this.onLogCall, 'before', 'call');
  }

  static initState(state: CustomState): void {
    state.scope = state.scope ?? [];
  }

  static startClassForLog(state: CustomState, node: ts.ClassDeclaration): typeof node {
    this.initState(state);
    state.scope.push({ type: 'class', name: node.name?.text ?? 'unknown' });
    return node;
  }

  static leaveClassForLog(state: CustomState, node: ts.ClassDeclaration): typeof node {
    state.scope.pop();
    return node;
  }

  static startMethodForLog(state: CustomState, node: ts.MethodDeclaration): typeof node {
    this.initState(state);
    let name = 'unknown';
    if (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name)) {
      name = node.name?.text ?? name;
    }
    state.scope.push({ type: 'method', name });
    return node;
  }

  static leaveMethodForLog(state: CustomState, node: ts.MethodDeclaration): typeof node {
    state.scope.pop();
    return node;
  }

  static startFunctionForLog(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    this.initState(state);
    state.scope.push({ type: 'function', name: node.name?.text ?? 'unknown' });
    return node;
  }

  static leaveFunctionForLog(state: CustomState, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    state.scope.pop();
    return node;
  }

  static onLogCall(state: CustomState, node: ts.CallExpression): typeof node | ts.Identifier {
    if (!ts.isPropertyAccessExpression(node.expression)) {
      return node;
    }

    const chain = node.expression;
    const name = chain.name;
    const expr = chain.expression;

    if (!ts.isIdentifier(expr) || expr.escapedText !== 'console' || !ts.isIdentifier(name)) {
      return node;
    }

    const level = name.escapedText!;

    if (VALID_LEVELS[level]) {
      const identifier = state.imported ??= state.importFile(CONSOLE_IMPORT).identifier;
      return state.factory.updateCallExpression(
        node,
        state.createAccess(identifier, 'log'),
        node.typeArguments,
        [
          LiteralUtil.fromLiteral(state.factory, {
            level: state.factory.createStringLiteral(VALID_LEVELS[level]),
            import: state.getModuleIdentifier(),
            line: state.source.getLineAndCharacterOfPosition(node.getStart(state.source)).line + 1,
            scope: state.scope?.map(part => part.name).join(':'),
            args: node.arguments.slice(0)
          }),
        ]
      );
    } else {
      return node;
    }
  }
}