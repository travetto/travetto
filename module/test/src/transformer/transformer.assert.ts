import * as ts from 'typescript';
import * as assert from 'assert';
import { TransformUtil, State } from '@encore2/compiler';

interface AssertState extends State {
  assert: ts.Identifier;
  assertUtil: ts.PropertyAccessExpression;
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

function isLiteral(node: ts.Expression) {
  return ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node);
}

function doAssert(state: AssertState, name: string, args: ts.Expression[]) {
  return ts.createCall(ts.createPropertyAccess(state.assertUtil, 'check'), undefined, [ts.createLiteral(name) as ts.Expression].concat(args));
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AssertState): T {
  node = ts.visitEachChild(node, c => visitNode(context, c, state), context);

  if (ts.isCallExpression(node)) {
    let exp: ts.Expression = node.expression;
    if (ts.isIdentifier(exp) && exp.getText() === 'assert') {

      if (!state.assert) {
        state.assert = ts.createIdentifier(`import_AssertUtil`);
        state.newImports.push({
          ident: state.assert,
          path: require.resolve('../runner/assert')
        });
        state.assertUtil = ts.createPropertyAccess(state.assert, 'AssertUtil');
      }


      const comp = node.arguments[0]!;
      const message = node.arguments.length === 2 ? node.arguments[1] : null;

      if (ts.isBinaryExpression(comp)) {
        let op = comp.operatorToken.kind;
        let newOp: string | undefined;

        if (op === ts.SyntaxKind.EqualsEqualsToken) {
          newOp = 'equal'; // a == b
        } else if (op === ts.SyntaxKind.ExclamationEqualsToken) {
          newOp = 'notEqual'; // a != b
        } else if (op === ts.SyntaxKind.EqualsEqualsEqualsToken) {
          newOp = 'strictEqual'; // a === b
        } else if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
          newOp = 'notStrictEqual'; // a !== b
        } else if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
          // a >= b
        } else if (op === ts.SyntaxKind.GreaterThanToken) {
          // a > b
        } else if (op === ts.SyntaxKind.LessThanEqualsToken) {
          // a <= b
        } else if (op === ts.SyntaxKind.LessThanToken) {
          // a < b
        }
        if (newOp) {
          let literal = isLiteral(comp.left) ? comp.left : isLiteral(comp.right) ? comp.right : undefined;
          if (newOp.includes('Equal')) {
            newOp = newOp.replace(/(e|E)qual/, a => `${a[0] === 'e' ? 'd' : 'D'}eep${a}`);
          }
          node = doAssert(state, newOp, [comp.left, comp.right, message!]) as typeof node;
        }

      } else if (ts.isPrefixUnaryExpression(comp) && comp.operator === ts.SyntaxKind.ExclamationToken) {
        if (ts.isPrefixUnaryExpression(comp.operand)) {
          let inner = comp.operand.operand;
          node = doAssert(state, 'ok', [inner, message!]) as typeof node; // !!v
        } else {
          node = doAssert(state, 'ok', [comp.operand, message!]) as typeof node; // !v
        }
      }
    } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression) && exp.expression.getText() === 'assert') {
      node = doAssert(state, exp.name.getText(), [...node.arguments]) as typeof node;
      // Already in near, final form, just rewrite to intermmediate
    }
  }

  return node;
}

const TRANSFORMER = TransformUtil.importingVisitor<AssertState>(() => ({}), visitNode);

export const AssertTransformer = {
  transformer: (context: ts.TransformationContext) => (source: ts.SourceFile) => {
    // Only apply to test files
    if (process.env.ENV === 'test' && source.fileName.includes('/test/') && !source.fileName.includes('/src/')) {
      return TRANSFORMER(context)(source);
    } else {
      return source;
    }
  },
  phase: 'before'
}