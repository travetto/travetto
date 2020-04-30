import * as ts from 'typescript';

import { FsUtil } from '@travetto/boot';
import { TransformUtil, TransformerState, OnCall, res } from '@travetto/compiler/src/transform-support';
import { DEEP_EQUALS_MAPPING, OPTOKEN_ASSERT, DEEP_LITERAL_TYPES } from '../src/assert/types';


const ASSERT_CMD = 'assert';
const ASSERT_UTIL = 'AssertCheck';

const METHODS: Record<string, [Function, string]> = {
  includes: [Array, 'includes'],
  test: [RegExp, 'test']
};

const OP_TOKEN_TO_NAME = new Map<number, string>();

const asrt = Symbol('assert');
const isTest = Symbol('isTest');

interface AssertState {
  [asrt]?: {
    assert: ts.Identifier;
    hasAssertCall?: boolean;
    assertCheck: ts.PropertyAccessExpression;
    checkThrow: ts.PropertyAccessExpression;
    checkThrowAsync: ts.PropertyAccessExpression;
  };
  [isTest]?: boolean;
}

type Args = ts.Expression[] | ts.NodeArray<ts.Expression>;
type Message = ts.Expression | undefined;

interface Command {
  fn: string;
  args: ts.Expression[];
  negate?: boolean;
}

// TODO: Document
export class AssertTransformer {

  static lookupOpToken(key: number) {
    if (OP_TOKEN_TO_NAME.size === 0) {
      Object.keys(ts.SyntaxKind)
        .filter(x => !/^\d+$/.test(x))
        .filter(x => !/^(Last|First)/.test(x))
        .forEach(x =>
          OP_TOKEN_TO_NAME.set(
            parseInt((ts.SyntaxKind as any)[x], 10), x));
    }

    const name = OP_TOKEN_TO_NAME.get(key)!;
    if (name in OPTOKEN_ASSERT) {
      return OPTOKEN_ASSERT[name as keyof typeof OPTOKEN_ASSERT];
    } else {
      throw new Error(`Unknown optoken: ${name}:${key}`);
    }
  }

  static isDeepLiteral(state: TransformerState, node: ts.Expression) {
    let found = ts.isArrayLiteralExpression(node) ||
      ts.isObjectLiteralExpression(node) ||
      (
        ts.isNewExpression(node) &&
        DEEP_LITERAL_TYPES.has(node.expression.getText())
      );

    // If looking at an identifier, see if it's in a diff file or if its const
    if (!found && ts.isIdentifier(node)) {
      found = !!state.getDeclarations(node).find(x =>
        // In a separate file or is const
        x.getSourceFile().fileName !== state.source.fileName ||
        TransformUtil.isConstantDeclaration(x));
    }

    return found;
  }

  static initState(state: TransformerState & AssertState) {
    if (!state[asrt]) {
      const assrt = state.importFile(require.resolve('../src/assert/check')).ident;
      state[asrt] = {
        assert: assrt,
        assertCheck: ts.createPropertyAccess(ts.createPropertyAccess(assrt, ASSERT_UTIL), 'check'),
        checkThrow: ts.createPropertyAccess(ts.createPropertyAccess(assrt, ASSERT_UTIL), 'checkThrow'),
        checkThrowAsync: ts.createPropertyAccess(ts.createPropertyAccess(assrt, ASSERT_UTIL), 'checkThrowAsync'),
      };
    }
  }

  static doAssert<T extends ts.CallExpression>(state: TransformerState & AssertState, node: T, cmd: Command): T {
    this.initState(state);

    const first = TransformUtil.getPrimaryArgument<ts.CallExpression>(node);
    const firstText = first!.getText();

    cmd.args = cmd.args.filter(x => x !== undefined && x !== null);
    const check = ts.createCall(state[asrt]!.assertCheck, undefined, ts.createNodeArray([
      ts.createIdentifier('__filename'),
      ts.createLiteral(firstText),
      ts.createLiteral(cmd.fn),
      ts.createLiteral(!cmd.negate),
      ...cmd.args
    ]));

    for (const arg of cmd.args) {
      arg.parent = check;
    }

    check.parent = node.parent;

    return check as T;
  }

  static doThrows(state: TransformerState & AssertState, node: ts.CallExpression, key: string, args: ts.Expression[]): ts.Node {
    const first = TransformUtil.getPrimaryArgument<ts.CallExpression>(node);
    const firstText = first!.getText();

    this.initState(state);
    return ts.createCall(
      /reject/i.test(key) ? state[asrt]!.checkThrowAsync : state[asrt]!.checkThrow,
      undefined,
      ts.createNodeArray([
        ts.createIdentifier('__filename'),
        ts.createLiteral(`${key} ${firstText}`),
        ts.createLiteral(`${key}`),
        ts.createLiteral(!key.startsWith('doesNot')),
        ...args
      ]));
  }

  static doBinaryCheck(state: TransformerState, comp: ts.BinaryExpression, message: Message, args: Args) {
    let opFn = this.lookupOpToken(comp.operatorToken.kind);

    if (opFn) {
      const literal = this.isDeepLiteral(state, comp.left) ? comp.left : this.isDeepLiteral(state, comp.right) ? comp.right : undefined;
      if (/equal/i.test(opFn) && literal) {
        opFn = DEEP_EQUALS_MAPPING[opFn] || opFn;
      }
      return { fn: opFn, args: [comp.left, comp.right, message!] };
    } else {
      return { fn: ASSERT_CMD, args: [...args] };
    }
  }

  static doUnaryCheck(state: TransformerState, comp: ts.PrefixUnaryExpression, message: Message, args: Args) {
    if (ts.isPrefixUnaryExpression(comp.operand)) {
      const inner = comp.operand.operand;
      return { fn: 'ok', args: [inner, message!] };
    } else {
      const inner = comp.operand;
      return { ...this.getCommand(state, [inner, ...args.slice(1)])!, negate: true };
    }
  }

  static doMethodCall(state: TransformerState, comp: ts.Expression, args: Args) {

    if (ts.isCallExpression(comp) && ts.isPropertyAccessExpression(comp.expression)) {
      const root = comp.expression.expression;
      const key = comp.expression.name;

      const matched = METHODS[key.text!];
      if (matched) {
        const resolved = state.resolveType(root);
        if (res.isLiteralType(resolved) && resolved.ctor === matched[0]) { // Ensure method is against real type
          return {
            fn: matched[1],
            args: [comp.arguments[0], comp.expression.expression, ...args.slice(1)]
          };
        }
      }
    }

    return { fn: ASSERT_CMD, args: [...args] };
  }

  static getCommand(state: TransformerState, args: Args): Command | undefined {

    const comp = args[0]!;
    const message = args.length === 2 ? args[1] : undefined;

    if (ts.isParenthesizedExpression(comp)) {
      return this.getCommand(state, [comp.expression, ...args.slice(1)]);
    } else if (ts.isBinaryExpression(comp)) {
      return this.doBinaryCheck(state, comp, message, args);
    } else if (ts.isPrefixUnaryExpression(comp) && comp.operator === ts.SyntaxKind.ExclamationToken) {
      return this.doUnaryCheck(state, comp, message, args);
    } else {
      return this.doMethodCall(state, comp, args);
    }
  }

  @OnCall()
  static handleCall(state: TransformerState & AssertState, node: ts.CallExpression) {
    if (state[isTest] === undefined) {
      const name = FsUtil.toUnix(state.source.fileName);
      // Only apply to test files, allowing for inheriting from module test files as well
      state[isTest] = (name.includes('/test/') && !name.includes('/src/')) || /@travetto\/[^/]+\/test/.test(name);
    }

    if (!state[isTest]) {
      return node;
    }

    const exp = node.expression;

    if (ts.isIdentifier(exp) && exp.getText() === ASSERT_CMD) { // Straight assert
      const cmd = this.getCommand(state, node.arguments);
      if (cmd) {
        node = this.doAssert(state, node, cmd);
      }
    } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) { // Assert method call
      const ident = exp.expression;
      const fn = exp.name.escapedText.toString();
      if (ident.escapedText === ASSERT_CMD) {
        if (/^(doesNot)?(Throw|Reject)s?$/i.test(fn)) {
          node = this.doThrows(state, node, fn, [...node.arguments]) as ts.CallExpression;
        } else {
          const sub = { ...this.getCommand(state, node.arguments)!, fn };
          node = this.doAssert(state, node, sub);
        }
      }
    }

    return node;
  }
}