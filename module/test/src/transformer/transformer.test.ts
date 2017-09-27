import * as ts from 'typescript';
import * as assert from 'assert';
import { TransformUtil, State } from '@encore2/compiler';

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

interface AssertState extends State {
  assert: ts.Identifier;
  hasAssertCall: boolean;
  assertCheck: ts.PropertyAccessExpression;
  assertInvoke: ts.PropertyAccessExpression;
  source: ts.SourceFile
}

function isDeepLiteral(node: ts.Expression) {
  return ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node);
}

function doAssert<T extends ts.CallExpression>(state: AssertState, node: T, name: string, args: ts.Expression[]): T {
  prepAssert(state);

  args = args.filter(x => x !== undefined && x !== null);
  let check = ts.createCall(state.assertCheck, undefined, ts.createNodeArray([
    ts.createLiteral(TransformUtil.getPrimaryArgument(node)!.getText()),
    ts.createLiteral(name),
    ...args
  ]));

  for (let arg of args) {
    arg.parent = check;
  }

  check.parent = node.parent;

  return check as any as T;
}

function prepAssert(state: AssertState) {
  if (!state.assert) {
    state.assert = ts.createIdentifier(`import_AssertUtil`);
    state.newImports.push({
      ident: state.assert,
      path: require.resolve('../exec/assert')
    });
    state.assertCheck = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, 'AssertUtil'), 'check');
    state.assertInvoke = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, 'AssertUtil'), 'invoke');
  }
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {
  if (ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) {
    let dec = TransformUtil.findAnyDecorator(node, {
      'Test': new Set(['@encore2/test']),
      'Suite': new Set(['@encore2/test'])
    }, state);
    if (dec) {
      if (ts.isCallExpression(dec.expression)) {
        let args = [...(dec.expression.arguments || [])];
        if (args.length === 0) {
          args = [ts.createLiteral('')];
        }

        const offset = state.hasAssertCall ? 4 : 3;
        const n = (node as any)['original'] || node;
        const src = ts.createSourceFile(state.source.fileName, state.source.text, state.source.languageVersion);
        const start = ts.getLineAndCharacterOfPosition(src, n.getFullStart());
        const end = ts.getLineAndCharacterOfPosition(src, n.getEnd());

        dec.expression.arguments = ts.createNodeArray([...args, TransformUtil.fromLiteral({
          line: start.line + offset,
          lineEnd: end.line + offset
        })]);
      }
    }
  }

  let replaced = false;

  if (ts.isCallExpression(node)) {
    let exp: ts.Expression = node.expression;
    if (ts.isIdentifier(exp) && exp.getText() === 'assert') {
      replaced = true;

      const comp = node.arguments[0]!;
      const message = node.arguments.length === 2 ? node.arguments[1] : undefined;

      if (ts.isBinaryExpression(comp)) {
        let opFn = OPTOKEN_ASSERT_FN[comp.operatorToken.kind];

        if (opFn) {
          let literal = isDeepLiteral(comp.left) ? comp.left : isDeepLiteral(comp.right) ? comp.right : undefined;
          if (/equal/i.test(opFn) && literal) {
            opFn = {
              strictEqual: 'deepStrictEqual', equal: 'deepEqual',
              notStrictEqual: 'notDeepStrictEqual', notEqual: 'notDeepEqual'
            }[opFn] || opFn;
          }

          node = doAssert(state, node, opFn, [comp.left, comp.right, message!]);
        } else {
          node = doAssert(state, node, 'assert', [...node.arguments]);
        }

      } else if (ts.isPrefixUnaryExpression(comp) && comp.operator === ts.SyntaxKind.ExclamationToken) {
        if (ts.isPrefixUnaryExpression(comp.operand)) {
          let inner = comp.operand.operand;
          node = doAssert(state, node, 'ok', [inner, message!]); // !!v
        } else {
          node = doAssert(state, node, 'ok', [comp.operand, message!]); // !v
        }
      } else {
        node = doAssert(state, node, 'assert', [...node.arguments]);
      }
    } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) {
      let ident = exp.expression;
      if (ident.escapedText === 'assert') {
        replaced = true;

        node = doAssert(state, node, exp.name.escapedText as string, [...node.arguments]);
        // Already in near, final form, just rewrite to intermmediate
      }
    }
  }

  if (!replaced) {
    node = ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }

  if (ts.isClassDeclaration(node)) {
    for (let el of node.members) {
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
    if (process.env.ENV === 'test' && source.fileName.includes('/test/') && !source.fileName.includes('/src/')) {
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  phase: 'before',
  priority: 0
}