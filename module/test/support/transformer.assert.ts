import { TransformUtil, TransformerState } from '@travetto/compiler';
import { Env } from '@travetto/base/src/env';

const OPTOKEN_ASSERT_FN: { [key: number]: string } = {
  [ts.SyntaxKind.EqualsEqualsToken]: 'equal',
  [ts.SyntaxKind.ExclamationEqualsToken]: 'notEqual',
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: 'strictEqual',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: 'notStrictEqual',
  [ts.SyntaxKind.GreaterThanEqualsToken]: 'greaterThanEqual',
  [ts.SyntaxKind.GreaterThanToken]: 'greaterThan',
  [ts.SyntaxKind.LessThanEqualsToken]: 'lessThanEqual',
  [ts.SyntaxKind.LessThanToken]: 'lessThan',
  [ts.SyntaxKind.InstanceOfKeyword]: 'instanceof'
};

const DEEP_EQUALS_MAPPING: { [key: string]: string } = {
  equal: 'deepEqual',
  notEqual: 'notDeepEqual',
  strictEqual: 'deepStrictEqual',
  notStrictEqual: 'notDeepStrictEqual'
};

const ASSERT_CMD = 'assert';
const ASSERT_UTIL = 'AssertUtil';

const METHODS: { [key: string]: string } = {
  includes: 'includes',
  test: 'test'
};

const METHOD_REGEX = new RegExp(`[.](${Object.keys(METHODS).join('|')})[(]`);

interface AssertState extends TransformerState {
  assert: ts.Identifier;
  hasAssertCall: boolean;
  assertCheck: ts.PropertyAccessExpression;
  assertInvoke: ts.PropertyAccessExpression;
  checkThrow: ts.PropertyAccessExpression;
  checkThrowAsync: ts.PropertyAccessExpression;
  source: ts.SourceFile;
}

interface Command {
  fn: string;
  args: ts.Expression[];
  negate?: boolean;
}

function isDeepLiteral(node: ts.Expression) {
  return ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node);
}

function initState(state: AssertState) {
  if (!state.assert) {
    state.assert = TransformUtil.importFile(state, require.resolve('../src/runner/assert')).ident;
    state.assertCheck = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'check');
    state.assertInvoke = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'invoke');
    state.checkThrow = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'checkThrow');
    state.checkThrowAsync = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'checkThrowAsync');
  }
}

function doAssert<T extends ts.CallExpression>(state: AssertState, node: T, cmd: Command): T {
  initState(state);

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

function doThrows(state: AssertState, node: ts.CallExpression, key: string, args: ts.Expression[]): ts.Node {
  const first = TransformUtil.getPrimaryArgument<ts.CallExpression>(node);
  const firstText = first!.getText();

  initState(state);
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

function getCommand(args: ts.Expression[] | ts.NodeArray<ts.Expression>): Command | undefined {

  const comp = args[0]!;
  const message = args.length === 2 ? args[1] : undefined;

  if (ts.isParenthesizedExpression(comp)) {
    return getCommand([comp.expression, ...args.slice(1)]);
  } else if (ts.isBinaryExpression(comp)) {
    let opFn = OPTOKEN_ASSERT_FN[comp.operatorToken.kind];

    if (opFn) {
      const literal = isDeepLiteral(comp.left) ? comp.left : isDeepLiteral(comp.right) ? comp.right : undefined;
      if (/equal/i.test(opFn) && literal) {
        opFn = DEEP_EQUALS_MAPPING[opFn] || opFn;
      }
      return { fn: opFn, args: [comp.left, comp.right, message!] };
    } else {
      return { fn: ASSERT_CMD, args: [...args] };
    }

  } else if (ts.isPrefixUnaryExpression(comp) && comp.operator === ts.SyntaxKind.ExclamationToken) {
    if (ts.isPrefixUnaryExpression(comp.operand)) {
      const inner = comp.operand.operand;
      return { fn: 'ok', args: [inner, message!] };
    } else {
      const inner = comp.operand;
      return { ...getCommand([inner, ...args.slice(1)])!, negate: true };
    }
  } else {
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
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {

  let replaced = false;

  if (ts.isCallExpression(node)) {
    const exp = node.expression;
    if (ts.isIdentifier(exp) && exp.getText() === ASSERT_CMD) {
      const cmd = getCommand(node.arguments);
      if (cmd) {
        node = doAssert(state, node, cmd);
        replaced = true;
      }
    } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) {
      const ident = exp.expression;
      if (ident.escapedText === ASSERT_CMD) {
        if (/^(doesNot)?(Throw|Reject)s?$/i.test(exp.name.escapedText.toString())) {
          node = doThrows(state, node, exp.name.escapedText.toString(), [...node.arguments]) as T;
        } else {
          node = doAssert(state, node, getCommand(node.arguments)!);
        }
        replaced = true;
      }
    }
  }

  if (!replaced) {
    node = ts.visitEachChild(node, c => visitNode(context, c, state), context);
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

const TRANSFORMER = TransformUtil.importingVisitor<AssertState>((source) => ({
  source,
  hasAssertCall: /\s+assert(.[^(]+)\(/.test(source!.text)
}), visitNode);

export const TestAssertTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    const name = source.fileName.replace(/[\\]+/g, '/');

    // Only apply to test files
    if (Env.test &&
      name.includes('/test/') &&
      !name.includes('/src/') &&
      !name.includes('/node_modules/')
    ) {
      // Assert
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  key: 'test:assert',
  phase: 'before',
  after: 'registry'
};