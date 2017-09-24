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
  [ts.SyntaxKind.LessThanToken]: 'lessThan'
}

interface AssertState extends State {
  assert: ts.Identifier;
  assertUtil: ts.PropertyAccessExpression;
  source: ts.SourceFile
}
/*
  namespace internal {
    export class AssertionError implements Error {
      name: string;
      message: string;
      actual: any;
      expected: any;
      operator: string;
      generatedMessage: boolean;
    }
*/

function isDeepLiteral(node: ts.Expression) {
  return ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node);
}

function doAssert<T extends ts.CallExpression>(state: AssertState, node: T, name: string, args: ts.Expression[]): T {
  prepAssert(state);

  args = args.filter(x => x !== undefined && x !== null);
  let ret = ts.createCall(state.assertUtil, undefined, ts.createNodeArray([
    ts.createLiteral(TransformUtil.getPrimaryArgument(node)!.getText()),
    ts.createLiteral(name),
    ...args
  ]));

  for (let arg of args) {
    arg.parent = ret;
  }
  ret.parent = node.parent;
  return ret as any as T;
}

function prepAssert(state: AssertState) {
  if (!state.assert) {
    state.assert = ts.createIdentifier(`import_AssertUtil`);
    state.newImports.push({
      ident: state.assert,
      path: require.resolve('../exec/assert')
    });
    state.assertUtil = ts.createPropertyAccess(ts.createPropertyAccess(state.assert, 'AssertUtil'), 'check');
  }
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {
  if (ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) {
    let dec = TransformUtil.findAnyDecorator(node, {
      'Test': new Set(['@encore2/test']),
      'Suite': new Set(['@encore2/test'])
    }, state);
    if (dec) {
      let info = ts.getLineAndCharacterOfPosition(state.source, node.pos);
      if (ts.isCallExpression(dec.expression)) {
        let args = [...(dec.expression.arguments || [])];
        if (args.length === 0) {
          args = [ts.createLiteral('')];
        }
        dec.expression.arguments = ts.createNodeArray([...args, TransformUtil.fromLiteral({
          line: info.line
        })]);
      }
    }
  }


  if (ts.isCallExpression(node)) {
    let exp: ts.Expression = node.expression;
    if (ts.isIdentifier(exp) && exp.getText() === 'assert') {

      const comp = node.arguments[0]!;
      const message = node.arguments.length === 2 ? node.arguments[1] : undefined;

      if (ts.isBinaryExpression(comp)) {
        let opFn = OPTOKEN_ASSERT_FN[comp.operatorToken.kind];

        if (opFn) {
          let literal = isDeepLiteral(comp.left) ? comp.left : isDeepLiteral(comp.right) ? comp.right : undefined;
          if (opFn.includes('qual') && literal) {
            opFn = opFn.replace(/(e|E)qual/, a => `${a[0] === 'e' ? 'd' : 'D'}eep${a}`);
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
      }
    } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) {
      let ident = exp.expression;
      if (ident.escapedText === 'assert') {
        node = doAssert(state, node, exp.name.escapedText as string, [...node.arguments]);
        // Already in near, final form, just rewrite to intermmediate
      }
    }
  }

  node = ts.visitEachChild(node, c => visitNode(context, c, state), context);

  if (ts.isClassDeclaration(node)) {
    for (let el of node.members) {
      if (!el.parent) {
        el.parent = node;
      }
    }
  }

  return node;
}

const TRANSFORMER = TransformUtil.importingVisitor<AssertState>((source) => ({ source }), visitNode);

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