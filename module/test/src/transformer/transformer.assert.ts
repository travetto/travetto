import * as ts from 'typescript';
import * as assert from 'assert';
import { TransformUtil, State } from '@travetto/compiler';

const OPTOKEN_ASSERT_FN: { [key: number]: string } = {
  [ts.SyntaxKind.EqualsEqualsToken]: 'equal',
  [ts.SyntaxKind.ExclamationEqualsToken]: 'notEqual',
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: 'strictEqual',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: 'notStrictEqual',
  [ts.SyntaxKind.GreaterThanEqualsToken]: 'greaterThanEqual',
  [ts.SyntaxKind.GreaterThanToken]: 'greaterThan',
  [ts.SyntaxKind.LessThanEqualsToken]: 'lessThanEqual',
  [ts.SyntaxKind.LessThanToken]: 'lessThan',
  [ts.SyntaxKind.InstanceOfKeyword]: 'instanceOf'
}

const EQUALS_MAPPING: { [key: string]: string } = {
  strictEqual: 'deepStrictEqual',
  equal: 'deepEqual',
  notStrictEqual: 'notDeepStrictEqual',
  notEqual: 'notDeepEqual'
}

const ASSERT_CMD = 'assert';
const TEST_IMPORT = '@travetto/test';
const ASSERT_UTIL = 'AssertUtil';

const METHODS: { [key: string]: string } = {
  includes: 'includes',
  test: 'test'
};

const METHOD_REGEX = new RegExp(`[.](${Object.keys(METHODS).join('|')})[(]`);

interface AssertState extends State {
  assert: ts.Identifier;
  hasAssertCall: boolean;
  assertCheck: ts.PropertyAccessExpression;
  assertInvoke: ts.PropertyAccessExpression;
  source: ts.SourceFile
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

function doAssert<T extends ts.CallExpression>(state: AssertState, node: T, cmd: Command): T {
  prepAssert(state);

  const first = TransformUtil.getPrimaryArgument<ts.CallExpression>(node);
  const firstText = first!.getText();

  // Handle METHOD
  if (METHOD_REGEX.test(firstText)) {
    if (first && ts.isCallExpression(first) && ts.isPropertyAccessExpression(first.expression)) {
      cmd.fn = METHODS[first.expression.name.text!];
      cmd.args = [first.arguments[0], first.expression.expression];
    }
  }

  cmd.args = cmd.args.filter(x => x !== undefined && x !== null);
  const check = ts.createCall(state.assertCheck, undefined, ts.createNodeArray([
    ts.createLiteral('__filename'),
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

function prepAssert(state: AssertState) {
  if (!state.assert) {
    state.assert = ts.createIdentifier(`import_${ASSERT_UTIL}`);
    state.newImports.push({
      ident: state.assert,
      path: require.resolve('../runner/assert')
    });
    state.assertCheck = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'check');
    state.assertInvoke = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, ASSERT_UTIL), 'invoke');
  }
}

function getCommand(node: ts.Node): Command | undefined {
  if (!ts.isCallExpression(node)) {
    return;
  }

  const exp: ts.Expression = node.expression;
  if (ts.isIdentifier(exp) && exp.getText() === ASSERT_CMD) {
    const comp = node.arguments[0]!;
    const message = node.arguments.length === 2 ? node.arguments[1] : undefined;

    if (ts.isBinaryExpression(comp)) {
      let opFn = OPTOKEN_ASSERT_FN[comp.operatorToken.kind];

      if (opFn) {
        const literal = isDeepLiteral(comp.left) ? comp.left : isDeepLiteral(comp.right) ? comp.right : undefined;
        if (/equal/i.test(opFn) && literal) {
          opFn = EQUALS_MAPPING[opFn] || opFn;
        }
        return { fn: opFn, args: [comp.left, comp.right, message!] };
      } else {
        return { fn: ASSERT_CMD, args: [...node.arguments] };
      }

    } else if (ts.isPrefixUnaryExpression(comp) && comp.operator === ts.SyntaxKind.ExclamationToken) {
      if (ts.isPrefixUnaryExpression(comp.operand)) {
        const inner = comp.operand.operand;
        return { fn: 'ok', args: [inner, message!] };
      } else {
        const inner = comp.operand;
        return { ...getCommand(inner)!, negate: true };
      }
    } else {
      return { fn: ASSERT_CMD, args: [...node.arguments] };
    }
  } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) {
    const ident = exp.expression;
    if (ident.escapedText === ASSERT_CMD) {
      return { fn: exp.name.escapedText as string, args: [...node.arguments] };
    }
  }
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {

  const cmd = getCommand(node);
  if (!cmd) {
    node = ts.visitEachChild(node, c => visitNode(context, c, state), context);
  } else if (ts.isCallExpression(node)) {
    node = doAssert(state, node, cmd);
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

export const TestTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    // Only apply to test files
    if (process.env.ENV === 'test' &&
      source.fileName.includes('/test/') &&
      !source.fileName.includes('/src/') &&
      !source.fileName.includes('/node_modules/')
    ) {
      // Assert
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  phase: 'before',
  priority: 10
}