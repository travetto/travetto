import * as ts from 'typescript';

/**
 * Utilities for dealing with literals
 */
export class LiteralUtil {

  /**
   * Determine if a type is a literal type
   * @param type
   */
  static isLiteralType(type: ts.Type): type is ts.LiteralType {
    const flags = type.getFlags();
    // eslint-disable-next-line no-bitwise
    return (flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.StringLiteral)) > 0;
  }

  /**
   * Convert literal to a `ts.Node` type
   */
  static fromLiteral<T extends ts.Expression>(factory: ts.NodeFactory, val: T): T;
  static fromLiteral(factory: ts.NodeFactory, val: undefined): ts.Identifier;
  static fromLiteral(factory: ts.NodeFactory, val: null): ts.NullLiteral;
  static fromLiteral(factory: ts.NodeFactory, val: object): ts.ObjectLiteralExpression;
  static fromLiteral(factory: ts.NodeFactory, val: unknown[]): ts.ArrayLiteralExpression;
  static fromLiteral(factory: ts.NodeFactory, val: string | boolean | number): ts.LiteralExpression;
  static fromLiteral(factory: ts.NodeFactory, val: unknown): ts.Node {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if (val && (val as ts.Expression).kind) { // If already a node
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return val as ts.Node;
    } else if (Array.isArray(val)) {
      val = factory.createArrayLiteralExpression(val.map(v => this.fromLiteral(factory, v)));
    } else if (val === undefined) {
      val = factory.createIdentifier('undefined');
    } else if (val === null) {
      val = factory.createNull();
    } else if (typeof val === 'string') {
      val = factory.createStringLiteral(val);
    } else if (typeof val === 'number') {
      val = factory.createNumericLiteral(val);
    } else if (typeof val === 'boolean') {
      val = val ? factory.createTrue() : factory.createFalse();
    } else if (val === String || val === Number || val === Boolean || val === Date || val === RegExp) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      val = factory.createIdentifier((val as Function).name);
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const ov = val as object;
      const pairs: ts.PropertyAssignment[] = [];
      for (const k of Object.keys(ov)) {
        if (ov[k] !== undefined) {
          pairs.push(
            factory.createPropertyAssignment(k, this.fromLiteral(factory, ov[k]))
          );
        }
      }
      return factory.createObjectLiteralExpression(pairs);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return val as ts.Expression;
  }

  /**
   * Convert a `ts.Node` to a JS literal
   */
  static toLiteral(val: ts.NullLiteral, strict?: boolean): null;
  static toLiteral(val: ts.NumericLiteral, strict?: boolean): number;
  static toLiteral(val: ts.StringLiteral, strict?: boolean): string;
  static toLiteral(val: ts.BooleanLiteral, strict?: boolean): boolean;
  static toLiteral(val: ts.ObjectLiteralExpression, strict?: boolean): object;
  static toLiteral(val: ts.ArrayLiteralExpression, strict?: boolean): unknown[];
  static toLiteral(val: undefined, strict?: boolean): undefined;
  static toLiteral(val: ts.Node, strict?: boolean): unknown;
  static toLiteral(val?: ts.Node, strict = true): unknown {
    if (!val) {
      throw new Error('Val is not defined');
    } else if (ts.isArrayLiteralExpression(val)) {
      return val.elements.map(x => this.toLiteral(x, strict));
    } else if (ts.isIdentifier(val)) {
      if (val.getText() === 'undefined') {
        return undefined;
      } else if (!strict) {
        return val.getText();
      }
    } else if (val.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    } else if (ts.isStringLiteral(val)) {
      return val.text;
    } else if (ts.isNumericLiteral(val)) {
      const txt = val.text;
      if (txt.includes('.')) {
        return parseFloat(txt);
      } else {
        return parseInt(txt, 10);
      }
    } else if (val.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    } else if (val.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    } else if (ts.isObjectLiteralExpression(val)) {
      const out: Record<string, unknown> = {};
      for (const pair of val.properties) {
        if (ts.isPropertyAssignment(pair)) {
          out[pair.name.getText()] = this.toLiteral(pair.initializer, strict);
        }
      }
      return out;
    }
    if (strict) {
      throw new Error(`Not a valid input, should be a valid ts.Node: ${val.kind}`);
    }
  }

  /**
   * Extend object literal, whether JSON or ts.ObjectLiteralExpression
   */
  static extendObjectLiteral(factory: ts.NodeFactory, src: object | ts.Expression, ...rest: (object | ts.Expression)[]): ts.ObjectLiteralExpression {
    let ret = this.fromLiteral(factory, src);
    if (rest.find(x => !!x)) {
      ret = factory.createObjectLiteralExpression([
        factory.createSpreadAssignment(ret),
        ...(rest.filter(x => !!x).map(r => factory.createSpreadAssignment(this.fromLiteral(factory, r))))
      ]);
    }
    return ret;
  }

  /**
   * Get a value from the an object expression
   */
  static getObjectValue(node: ts.Expression | undefined, key: string): ts.Expression | undefined {
    if (node && ts.isObjectLiteralExpression(node) && node.properties) {
      for (const prop of node.properties) {
        if (prop.name!.getText() === key) {
          if (ts.isPropertyAssignment(prop)) {
            return prop.initializer;
          } else if (ts.isShorthandPropertyAssignment(prop)) {
            return prop.name;
          }
        }
      }
    }
    return undefined;
  }
}