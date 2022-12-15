import ts from 'typescript';

import { TransformerState, OnCall, DeclarationUtil, CoreUtil, OnMethod, AfterMethod } from '@travetto/transformer';

/**
 * Which types are candidates for deep literal checking
 */
export const DEEP_LITERAL_TYPES = new Set(['Set', 'Map', 'Array', 'String', 'Number', 'Object', 'Boolean']);

/**
 * Mapping of assert equal methods to assert deep equal methods
 */
export const DEEP_EQUALS_MAPPING: Record<string, string> = {
  equal: 'deepEqual',
  notEqual: 'notDeepEqual',
  strictEqual: 'deepStrictEqual',
  notStrictEqual: 'notDeepStrictEqual'
};

/**
 * Typescript optoken to assert methods
 */
export const OPTOKEN_ASSERT = {
  InKeyword: 'in',
  EqualsEqualsToken: 'equal',
  ExclamationEqualsToken: 'notEqual',
  EqualsEqualsEqualsToken: 'strictEqual',
  ExclamationEqualsEqualsToken: 'notStrictEqual',
  GreaterThanEqualsToken: 'greaterThanEqual',
  GreaterThanToken: 'greaterThan',
  LessThanEqualsToken: 'lessThanEqual',
  LessThanToken: 'lessThan',
  InstanceOfKeyword: 'instanceof',
  AmpersandAmpersandToken: '', // Default to assert
  BarBarToken: '' // Default to assert
};

const ASSERT_CMD = 'assert';
const ASSERT_UTIL = 'AssertCheck';

/**
 * Special methods with special treatment (vs just boolean checking)
 */
const METHODS: Record<string, Function[]> = {
  includes: [Array, String],
  test: [RegExp]
};

const OP_TOKEN_TO_NAME = new Map<number, keyof typeof OPTOKEN_ASSERT>();

const AssertⲐ = Symbol.for('@travetto/test:assert');
const IsTestⲐ = Symbol.for('@travetto/test:valid');

/**
 * Assert transformation state
 */
interface AssertState {
  [AssertⲐ]?: {
    assert: ts.Identifier;
    hasAssertCall?: boolean;
    assertCheck: ts.PropertyAccessExpression;
    checkThrow: ts.PropertyAccessExpression;
    checkThrowAsync: ts.PropertyAccessExpression;
  };
  [IsTestⲐ]?: boolean;
}

/**
 * List of assertion arguments
 */
type Args = ts.Expression[] | ts.NodeArray<ts.Expression>;

/**
 * Assertion message
 */
type Message = ts.Expression | undefined;

/**
 * A specific assertion command
 */
interface Command {
  fn: string;
  args: ts.Expression[];
  negate?: boolean;
}

/**
 * Looks within test files to instrument `assert()` calls to allow for detection,
 * and result generation
 */
export class AssertTransformer {

  /**
   * Resolves optoken to syntax kind.  Relies on `ts`
   */
  static lookupOpToken(key: number): string {
    if (OP_TOKEN_TO_NAME.size === 0) {
      Object.keys(ts.SyntaxKind)
        .filter(x => !/^\d+$/.test(x))
        .filter((x): x is keyof typeof OPTOKEN_ASSERT => !/^(Last|First)/.test(x))
        .forEach(x =>
          OP_TOKEN_TO_NAME.set(ts.SyntaxKind[x], x));
    }

    const name = OP_TOKEN_TO_NAME.get(key)!;
    if (name in OPTOKEN_ASSERT) {
      return OPTOKEN_ASSERT[name];
    } else {
      throw new Error(`Unknown optoken: ${name}:${key}`);
    }
  }

  /**
   * Determine if element is a deep literal (should use deep comparison)
   */
  static isDeepLiteral(state: TransformerState, node: ts.Expression): boolean {
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
        DeclarationUtil.isConstantDeclaration(x));
    }

    return found;
  }

  /**
   * Initialize transformer state
   */
  static initState(state: TransformerState & AssertState): void {
    if (!state[AssertⲐ]) {
      const assrt = state.importFile('@travetto/test/src/assert/check').ident;
      state[AssertⲐ] = {
        assert: assrt,
        assertCheck: CoreUtil.createAccess(state.factory, assrt, ASSERT_UTIL, 'check'),
        checkThrow: CoreUtil.createAccess(state.factory, assrt, ASSERT_UTIL, 'checkThrow'),
        checkThrowAsync: CoreUtil.createAccess(state.factory, assrt, ASSERT_UTIL, 'checkThrowAsync'),
      };
    }
  }

  /**
   * Convert the assert to call the framework `AssertUtil.check` call
   */
  static doAssert(state: TransformerState & AssertState, node: ts.CallExpression, cmd: Command): ts.CallExpression {
    this.initState(state);

    const first = CoreUtil.getArgument<ts.CallExpression>(node);
    const firstText = first!.getText();

    cmd.args = cmd.args.filter(x => x !== undefined && x !== null);
    const check = state.factory.createCallExpression(state[AssertⲐ]!.assertCheck, undefined, state.factory.createNodeArray([
      state.fromLiteral({
        file: state.createIdentifier('__output'),
        line: state.fromLiteral(ts.getLineAndCharacterOfPosition(state.source, node.getStart()).line + 1),
        text: state.fromLiteral(firstText),
        operator: state.fromLiteral(cmd.fn)
      }),
      state.fromLiteral(!cmd.negate),
      ...cmd.args
    ]));

    return check;
  }

  /**
   * Convert `assert.(throws|rejects|doesNotThrow|doesNotReject)` to the appropriate structure
   */
  static doThrows(state: TransformerState & AssertState, node: ts.CallExpression, key: string, args: ts.Expression[]): ts.CallExpression {
    const first = CoreUtil.getArgument<ts.CallExpression>(node);
    const firstText = first!.getText();

    this.initState(state);
    return state.factory.createCallExpression(
      /reject/i.test(key) ? state[AssertⲐ]!.checkThrowAsync : state[AssertⲐ]!.checkThrow,
      undefined,
      state.factory.createNodeArray([
        state.fromLiteral({
          file: state.createIdentifier('__output'),
          line: state.fromLiteral(ts.getLineAndCharacterOfPosition(state.source, node.getStart()).line + 1),
          text: state.fromLiteral(`${key} ${firstText}`),
          operator: state.fromLiteral(`${key}`)
        }),
        state.fromLiteral(key.startsWith('doesNot')),
        ...args
      ]));
  }

  /**
   * Check a binary expression (left and right) to see how we should communicate the assert
   */
  static doBinaryCheck(state: TransformerState, comp: ts.BinaryExpression, message: Message, args: Args): Command {
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

  /**
   * Check unary operator
   */
  static doUnaryCheck(state: TransformerState, comp: ts.PrefixUnaryExpression, message: Message, args: Args): Command {
    if (ts.isPrefixUnaryExpression(comp.operand)) {
      const inner = comp.operand.operand;
      return { fn: 'ok', args: [inner, message!] };
    } else {
      const inner = comp.operand;
      return { ...this.getCommand(state, [inner, ...args.slice(1)])!, negate: true };
    }
  }

  /**
   * Check various `assert.*` method calls
   */
  static doMethodCall(state: TransformerState, comp: ts.Expression, args: Args): Command {

    if (ts.isCallExpression(comp) && ts.isPropertyAccessExpression(comp.expression)) {
      const root = comp.expression.expression;
      const key = comp.expression.name;

      const matched = METHODS[key.text!];
      if (matched) {
        const resolved = state.resolveType(root);
        if (resolved.key === 'literal' && matched.find(x => resolved.ctor === x)) { // Ensure method is against real type
          return {
            fn: key.text,
            args: [comp.arguments[0], comp.expression.expression, ...args.slice(1)]
          };
        }
      }
    }

    return { fn: ASSERT_CMD, args: [...args] };
  }

  /**
   * Determine which type of check to perform
   */
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

  @OnMethod('AssertCheck')
  static onAssertCheck(state: TransformerState & AssertState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    state[IsTestⲐ] = true;
    return node;
  }

  @AfterMethod('AssertCheck')
  static afterAssertCheck(state: TransformerState & AssertState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    state[IsTestⲐ] = false;
    return node;
  }

  /**
   * Listen for all call expression
   */
  @OnCall()
  static onAssertCall(state: TransformerState & AssertState, node: ts.CallExpression): ts.CallExpression {
    // Only check in test mode
    if (!state[IsTestⲐ]) {
      return node;
    }

    const exp = node.expression;

    // Determine if calling assert directly
    if (ts.isIdentifier(exp) && exp.getSourceFile() && exp.getText() === ASSERT_CMD) { // Straight assert
      const cmd = this.getCommand(state, node.arguments);
      if (cmd) {
        node = this.doAssert(state, node, cmd);
      }
      // If calling `assert.*`
    } else if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression)) { // Assert method call
      const ident = exp.expression;
      const fn = exp.name.escapedText.toString();
      if (ident.escapedText === ASSERT_CMD) {
        // Look for reject/throw
        if (/^(doesNot)?(Throw|Reject)s?$/i.test(fn)) {
          node = this.doThrows(state, node, fn, [...node.arguments]);
        } else {
          const sub = { ...this.getCommand(state, node.arguments)!, fn };
          node = this.doAssert(state, node, sub);
        }
      }
    }

    return node;
  }
}