import * as ts from 'typescript';

import { TransformUtil, TransformerState } from '@travetto/compiler';
import { FsUtil } from '@travetto/base/bootstrap';
import { DEEP_EQUALS_MAPPING, OPTOKEN_ASSERT, DEEP_LITERAL_TYPES } from '../src/assert/types';

const ASSERT_CMD = 'assert';
const ASSERT_UTIL = 'AssertCheck';

const METHODS: { [key: string]: string } = {
  includes: 'includes',
  test: 'test'
};

const METHOD_REGEX = new RegExp(`[.](${Object.keys(METHODS).join('|')})[(]`);

const OP_TOKEN_TO_NAME = new Map<number, string>();

interface AssertState extends TransformerState {
  assert: ts.Identifier;
  hasAssertCall: boolean;
  assertCheck: ts.PropertyAccessExpression;
  checkThrow: ts.PropertyAccessExpression;
  checkThrowAsync: ts.PropertyAccessExpression;
  source: ts.SourceFile;
}

type Args = ts.Expression[] | ts.NodeArray<ts.Expression>;
type Message = ts.Expression | undefined;

interface Command {
  fn: string;
  args: ts.Expression[];
  negate?: boolean;
}

class AssertTransformer {

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

  static isDeepLiteral(node: ts.Expression) {
    return ts.isArrayLiteralExpression(node) ||
      ts.isObjectLiteralExpression(node) ||
      (ts.isNewExpression(node) && DEEP_LITERAL_TYPES.has(node.expression.getText()));
  }

  static initState(state: AssertState) {
    if (!state.assert) {
      state.assert = TransformUtil.importFile(state, require.resolve('../src/assert/check')).ident;
      state.assertCheck = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'check');
      state.checkThrow = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'checkThrow');
      state.checkThrowAsync = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'checkThrowAsync');
    }
  }

  static doAssert<T extends ts.CallExpression>(state: AssertState, node: T, cmd: Command): T {
    this.initState(state);

    const first = TransformUtil.getPrimaryArgument<ts.CallExpression>(node);
    const firstText = first!.getText();

    cmd.args = cmd.args.filter(x => x !== undefined && x !== null);
    const check = ts.createCall(state.assertCheck, undefined, ts.createNodeArray([
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

    return check as any as T;
  }

  static doThrows(state: AssertState, node: ts.CallExpression, key: string, args: ts.Expression[]): ts.Node {
    const first = TransformUtil.getPrimaryArgument<ts.CallExpression>(node);
    const firstText = first!.getText();

    this.initState(state);
    return ts.createCall(
      /reject/i.test(key) ? state.checkThrowAsync : state.checkThrow,
      undefined,
      ts.createNodeArray([
        ts.createIdentifier('__filename'),
        ts.createLiteral(`${key} ${firstText}`),
        ts.createLiteral(`${key}`),
        ts.createLiteral(!key.startsWith('doesNot')),
        ...args
      ]));
  }

  static doBinaryCheck(comp: ts.BinaryExpression, message: Message, args: Args) {
    let opFn = this.lookupOpToken(comp.operatorToken.kind);

    if (opFn) {
      const literal = this.isDeepLiteral(comp.left) ? comp.left : this.isDeepLiteral(comp.right) ? comp.right : undefined;
      if (/equal/i.test(opFn) && literal) {
        opFn = DEEP_EQUALS_MAPPING[opFn] || opFn;
      }
      return { fn: opFn, args: [comp.left, comp.right, message!] };
    } else {
      return { fn: ASSERT_CMD, args: [...args] };
    }
  }

  static doUnaryCheck(comp: ts.PrefixUnaryExpression, message: Message, args: Args) {
    if (ts.isPrefixUnaryExpression(comp.operand)) {
      const inner = comp.operand.operand;
      return { fn: 'ok', args: [inner, message!] };
    } else {
      const inner = comp.operand;
      return { ...this.getCommand([inner, ...args.slice(1)])!, negate: true };
    }
  }

  static doMethodCall(comp: ts.Expression, args: Args) {
    // Handle METHOD
    const firstText = comp.getText();
    if (METHOD_REGEX.test(`.${firstText}`) && ts.isCallExpression(comp) && ts.isPropertyAccessExpression(comp.expression)) {
      return {
        fn: METHODS[comp.expression.name.text!],
        args: [comp.arguments[0], comp.expression.expression, ...args.slice(1)]
      };
    } else {
      return { fn: ASSERT_CMD, args: [...args] };
    }
  }

  static getCommand(args: Args): Command | undefined {

    const comp = args[0]!;
    const message = args.length === 2 ? args[1] : undefined;

    if (ts.isParenthesizedExpression(comp)) {
      return this.getCommand([comp.expression, ...args.slice(1)]);
    } else if (ts.isBinaryExpression(comp)) {
      return this.doBinaryCheck(comp, message, args);
    } else if (ts.isPrefixUnaryExpression(comp) && comp.operator === ts.SyntaxKind.ExclamationToken) {
      return this.doUnaryCheck(comp, message, args);
    } else {
      return this.doMethodCall(comp, args);
    }
  }

  static visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {

    let replaced = false;

    if (ts.isCallExpression(node)) {
      const exp = node.expression;
      if (ts.isIdentifier(exp) && exp.getText() === ASSERT_CMD) { // Straight assert
        const cmd = this.getCommand(node.arguments);
        if (cmd) {
          node = this.doAssert(state, node, cmd);
          replaced = true;
        }
      } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) { // Assert method call
        const ident = exp.expression;
        const fn = exp.name.escapedText.toString();
        if (ident.escapedText === ASSERT_CMD) {
          if (/^(doesNot)?(Throw|Reject)s?$/i.test(fn)) {
            node = this.doThrows(state, node, fn, [...node.arguments]) as T;
          } else {
            const sub = { ...this.getCommand(node.arguments)!, fn };
            node = this.doAssert(state, node, sub);
          }
          replaced = true;
        }
      }
    }

    if (!replaced) {
      node = ts.visitEachChild(node, c => this.visitNode(context, c, state), context);
    }

    if (ts.isClassDeclaration(node)) {
      for (const el of node.members) {
        if (!el.parent) {
          el.parent = node;
        }
      }
    }

    return node;
  }
}

const TRANSFORMER = TransformUtil.importingVisitor<AssertState>((source) => ({ source }),
  AssertTransformer.visitNode.bind(AssertTransformer));

export const TestAssertTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    const name = FsUtil.toUnix(source.fileName);

    // Only apply to test files
    if (/\/test\//.test(name) &&
      !/\/(src|node_modules)\//.test(name) &&
      /\s+assert[^(]*\(/.test(source!.text)
    ) {
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  key: 'test:assert',
  phase: 'before',
  after: 'registry'
};